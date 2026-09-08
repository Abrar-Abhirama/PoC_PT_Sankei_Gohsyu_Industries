#!/usr/bin/env node

/**
 * Mock IPC / OPC UA Client Simulator for PT Sankei Gohsyu Industries
 * PoC Scope — Simplified OK / NG Machine Inspection
 * 
 * Target Architecture:
 *   PLC
 *   → OPC UA Server
 *   → OPC UA Client running on the Industrial PC (simulated by this script)
 *   → Node.js Backend (POST /api/v1/machine-results)
 *   → PostgreSQL (machine_results table)
 *   → React Dashboard
 * 
 * Domain Model:
 *   {
 *     "machineId": "MACHINE-01",
 *     "status": "OK" | "NG",
 *     "timestamp": "2026-09-08T10:30:00Z"
 *   }
 */

const http = require('http');
const readline = require('readline');

const BACKEND_HOST = process.env.BACKEND_HOST || 'localhost';
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || '3000', 10);
const DEFAULT_MACHINE_ID = process.env.MACHINE_ID || 'MACHINE-01';

// ANSI color formatting
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

function log(color, prefix, message) {
  const time = new Date().toLocaleTimeString();
  console.log(`${colors.gray}[${time}]${colors.reset} ${color}${prefix}${colors.reset} ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * HTTP Client helper
 */
function apiRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: BACKEND_HOST,
        port: BACKEND_PORT,
        path: `/api/v1${path}`,
        method,
        headers: payload
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            }
          : {},
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );

    req.on('error', (err) => {
      reject(new Error(`Failed to connect to Backend (${BACKEND_HOST}:${BACKEND_PORT}): ${err.message}`));
    });

    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * Send machine inspection result (OK or NG) to backend
 * 
 * Payload:
 * {
 *   "machineId": "MACHINE-01",
 *   "status": "OK" | "NG",
 *   "timestamp": "2026-09-08T..."
 * }
 */
async function sendMachineResult(status, machineId = DEFAULT_MACHINE_ID) {
  if (status !== 'OK' && status !== 'NG') {
    throw new Error(`Invalid status: '${status}'. Allowed values: 'OK', 'NG'`);
  }

  const timestamp = new Date().toISOString();
  const payload = {
    machineId,
    status,
    timestamp,
  };

  const isOk = status === 'OK';
  log(
    isOk ? colors.cyan : colors.magenta,
    '[OPC-UA CLIENT]',
    `Reading PLC tag -> Sending machine result: ${isOk ? colors.green + 'OK' : colors.red + 'NG'}${colors.reset} for ${colors.bright}${machineId}${colors.reset}`
  );

  const res = await apiRequest('POST', '/machine-results', payload);

  if (res.status === 201) {
    const record = res.body?.data;
    log(
      colors.green,
      '[BACKEND RESPONSE]',
      `Recorded Result #${record.id} | Machine: ${record.machineId} | Status: ${isOk ? colors.green + 'OK ✅' : colors.red + 'NG ❌'}${colors.reset} | Time: ${record.timestamp}`
    );
    return record;
  } else {
    log(colors.red, '[ERROR]', `HTTP ${res.status}: ${res.body?.error || JSON.stringify(res.body)}`);
    throw new Error(res.body?.error || `HTTP ${res.status}`);
  }
}

/**
 * Continuous Simulation Loop
 * Periodically sends simulated inspection results (~88% OK, ~12% NG)
 */
async function runContinuousSimulation(machineId = DEFAULT_MACHINE_ID, intervalMs = 2500) {
  console.log(`\n${colors.bright}${colors.cyan}Starting Continuous OPC UA Client Simulation on ${machineId}${colors.reset}`);
  console.log(`${colors.gray}Interval: ${intervalMs}ms. Press Ctrl+C to stop.\n${colors.reset}`);

  let total = 0;
  let okCount = 0;
  let ngCount = 0;

  const onExit = () => {
    console.log(`\n${colors.yellow}Simulation stopped. Total: ${total} (OK: ${okCount}, NG: ${ngCount})${colors.reset}`);
    process.exit(0);
  };
  process.on('SIGINT', onExit);
  process.on('SIGTERM', onExit);

  while (true) {
    total++;
    const roll = Math.random();
    const status = roll < 0.88 ? 'OK' : 'NG';

    try {
      await sendMachineResult(status, machineId);
      if (status === 'OK') okCount++;
      else ngCount++;
    } catch (err) {
      log(colors.red, '[EXCEPTION]', err.message);
    }

    await sleep(intervalMs);
  }
}

/**
 * Interactive CLI Menu
 */
function showInteractiveMenu() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`\n${colors.bright}${colors.cyan}======================================================${colors.reset}`);
  console.log(`${colors.bright}   Sankei Gohsyu — OPC UA Client Simulator (PoC)    ${colors.reset}`);
  console.log(`${colors.cyan}======================================================${colors.reset}`);
  console.log(`Backend Target: http://${BACKEND_HOST}:${BACKEND_PORT}/api/v1/machine-results`);
  console.log(`Target Machine: ${DEFAULT_MACHINE_ID}`);
  console.log(`Data Model    : { machineId, status: "OK" | "NG", timestamp }\n`);
  console.log('Select an option:');
  console.log('  1) Send Machine Result: OK (PASS)');
  console.log('  2) Send Machine Result: NG (FAIL / Defect)');
  console.log('  3) Run Continuous Simulation Loop (Ctrl+C to stop)');
  console.log('  4) View Current Machine Statistics');
  console.log('  0) Exit\n');

  rl.question('Enter option [1-4, 0]: ', async (ans) => {
    rl.close();
    const choice = ans.trim();

    try {
      switch (choice) {
        case '1':
          await sendMachineResult('OK', DEFAULT_MACHINE_ID);
          break;
        case '2':
          await sendMachineResult('NG', DEFAULT_MACHINE_ID);
          break;
        case '3':
          await runContinuousSimulation(DEFAULT_MACHINE_ID, 2500);
          return;
        case '4': {
          const res = await apiRequest('GET', `/machine-results/stats?machineId=${DEFAULT_MACHINE_ID}`);
          console.log('\nMachine Statistics:', JSON.stringify(res.body?.data, null, 2));
          break;
        }
        case '0':
          console.log('Goodbye!');
          process.exit(0);
        default:
          console.log(colors.yellow + 'Invalid option.' + colors.reset);
      }
    } catch (err) {
      log(colors.red, '[ERROR]', err.message);
    }

    showInteractiveMenu();
  });
}

// CLI Argument Parsing
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node mock-ipc/index.js [options]

Architecture:
  PLC -> OPC UA Server -> OPC UA Client (mock-ipc) -> Node.js Backend -> PostgreSQL -> React Dashboard

Options:
  --ok                  Send a machine result with status: "OK"
  --ng                  Send a machine result with status: "NG"
  --continuous, -c      Run continuous simulation loop
  --interval <ms>       Loop interval in ms (default: 2500)
  --machine <id>        Machine ID to target (default: MACHINE-01)
  --help, -h            Show this help text

Examples:
  node mock-ipc/index.js --ok
  node mock-ipc/index.js --ng
  node mock-ipc/index.js --continuous --interval 2000
`);
    process.exit(0);
  }

  const machineIndex = args.indexOf('--machine');
  const machineId = machineIndex !== -1 && args[machineIndex + 1] ? args[machineIndex + 1] : DEFAULT_MACHINE_ID;

  if (args.includes('--ok') || args.includes('--pass')) {
    await sendMachineResult('OK', machineId);
    process.exit(0);
  }

  if (args.includes('--ng') || args.includes('--fail')) {
    await sendMachineResult('NG', machineId);
    process.exit(0);
  }

  if (args.includes('--continuous') || args.includes('-c')) {
    const intervalIdx = args.indexOf('--interval');
    const interval = intervalIdx !== -1 && args[intervalIdx + 1] ? parseInt(args[intervalIdx + 1], 10) : 2500;
    await runContinuousSimulation(machineId, interval);
    return;
  }

  // Launch interactive menu if no arguments
  showInteractiveMenu();
}

main().catch((err) => {
  console.error(colors.red + 'Fatal Error: ' + err.message + colors.reset);
  process.exit(1);
});
