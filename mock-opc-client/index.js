#!/usr/bin/env node

/**
 * Mock OPC UA Client for PT Sankei Gohsyu Industries
 * 
 * Simulates the future OPC UA Client running on an Industrial PC.
 * It sends machine inspection results (OK / NG) directly to the Node.js backend.
 * 
 * Architecture:
 *   PLC → OPC UA Server → [Mock OPC UA Client] → Node.js Backend → PostgreSQL
 * 
 * Note:
 * - Does NOT connect to a real PLC.
 * - Does NOT implement OPC UA protocol over TCP.
 * - Formats data into standard JSON and submits to POST /api/v1/machine-results.
 */

const http = require('http');
const https = require('https');
const readline = require('readline');

// ==========================================
// Configuration & Environment Variables
// ==========================================

function resolveApiBaseUrl() {
  const envUrl = process.env.BACKEND_URL;
  if (envUrl && envUrl.trim()) {
    let clean = envUrl.trim().replace(/\/+$/, '');
    if (!clean.endsWith('/api/v1')) {
      clean += '/api/v1';
    }
    return clean;
  }

  const host = process.env.BACKEND_HOST || 'localhost';
  const port = process.env.BACKEND_PORT || '3000';
  return `http://${host}:${port}/api/v1`;
}

let API_BASE_URL = resolveApiBaseUrl();
let DEFAULT_MACHINE_ID = process.env.MACHINE_ID || 'MACHINE-01';

// ==========================================
// ANSI Color Helpers
// ==========================================
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function formatTime() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function log(level, message) {
  const timestamp = `${colors.gray}[${formatTime()}]${colors.reset}`;
  let tag = '';
  switch (level) {
    case 'INFO':
      tag = `${colors.cyan}[INFO]${colors.reset}`;
      break;
    case 'OK':
      tag = `${colors.green}[OK ✅]${colors.reset}`;
      break;
    case 'NG':
      tag = `${colors.red}[NG ❌]${colors.reset}`;
      break;
    case 'WARN':
      tag = `${colors.yellow}[WARN]${colors.reset}`;
      break;
    case 'ERROR':
      tag = `${colors.red}[ERROR]${colors.reset}`;
      break;
    case 'CLIENT':
      tag = `${colors.magenta}[OPC-CLIENT]${colors.reset}`;
      break;
    default:
      tag = `[${level}]`;
  }
  console.log(`${timestamp} ${tag} ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==========================================
// HTTP Request Helper
// ==========================================
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(`${API_BASE_URL}${path}`);
    const isHttps = fullUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const payload = body ? JSON.stringify(body) : null;
    const req = client.request(
      fullUrl,
      {
        method,
        headers: payload
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            }
          : {},
        timeout: 6000,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Connection timed out after 6000ms connecting to ${fullUrl.origin}`));
    });

    req.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        reject(
          new Error(
            `Connection refused at ${fullUrl.origin}. Is the backend running on this host/port?`
          )
        );
      } else if (err.code === 'ENOTFOUND') {
        reject(new Error(`Host not found: ${fullUrl.hostname}`));
      } else {
        reject(new Error(`Network error (${err.code || 'UNKNOWN'}): ${err.message}`));
      }
    });

    if (payload) req.write(payload);
    req.end();
  });
}

// ==========================================
// Core Domain Action: Send Machine Result
// ==========================================
async function sendMachineResult(status, machineId = DEFAULT_MACHINE_ID) {
  const upperStatus = (status || '').toUpperCase().trim();
  if (upperStatus !== 'OK' && upperStatus !== 'NG') {
    throw new Error(`Invalid status "${status}". Allowed values are strictly 'OK' or 'NG'.`);
  }

  const timestamp = new Date().toISOString();
  const payload = {
    machineId,
    status: upperStatus,
    timestamp,
  };

  const isOk = upperStatus === 'OK';
  log(
    'CLIENT',
    `Simulated PLC inspection trigger -> Sending ${
      isOk ? colors.green + colors.bold + 'OK' : colors.red + colors.bold + 'NG'
    }${colors.reset} result for machine ${colors.bold}${machineId}${colors.reset}`
  );

  try {
    const res = await request('POST', '/machine-results', payload);

    if (res.status === 201 && res.body?.success) {
      const data = res.body.data;
      log(
        isOk ? 'OK' : 'NG',
        `Successfully stored in PostgreSQL | ID: ${colors.bold}#${data.id}${colors.reset} | Machine: ${data.machineId} | Status: ${
          isOk ? colors.green + 'OK' : colors.red + 'NG'
        }${colors.reset} | Timestamp: ${data.timestamp}`
      );
      return data;
    } else {
      const errMsg = res.body?.error || JSON.stringify(res.body);
      log('ERROR', `Backend rejected request with HTTP ${res.status}: ${errMsg}`);
      throw new Error(`HTTP ${res.status}: ${errMsg}`);
    }
  } catch (err) {
    log('ERROR', `Failed to send result to backend: ${err.message}`);
    throw err;
  }
}

// ==========================================
// Periodic / Continuous Simulation Mode
// ==========================================
async function runPeriodicSimulation({
  machineId = DEFAULT_MACHINE_ID,
  intervalMs = 2000,
  okRatio = 85,
  maxCount = Infinity,
} = {}) {
  console.log(`\n${colors.cyan}${colors.bold}====================================================${colors.reset}`);
  console.log(`${colors.bold}  Mock OPC UA Client — Periodic Simulation Started   ${colors.reset}`);
  console.log(`${colors.cyan}====================================================${colors.reset}`);
  console.log(`Target URL   : ${API_BASE_URL}/machine-results`);
  console.log(`Machine ID   : ${machineId}`);
  console.log(`Interval     : ${intervalMs} ms`);
  console.log(`Target Yield : ~${okRatio}% OK, ~${100 - okRatio}% NG`);
  if (maxCount !== Infinity) console.log(`Total Cycles : ${maxCount}`);
  console.log(`${colors.gray}Press Ctrl+C to stop the simulation.${colors.reset}\n`);

  let count = 0;
  let okCount = 0;
  let ngCount = 0;

  const onStop = () => {
    console.log(`\n${colors.yellow}${colors.bold}Simulation stopped.${colors.reset}`);
    const yieldRate = count > 0 ? ((okCount / count) * 100).toFixed(1) : 0;
    console.log(
      `Summary: Total: ${count} | OK: ${colors.green}${okCount}${colors.reset} | NG: ${colors.red}${ngCount}${colors.reset} | Yield: ${yieldRate}%\n`
    );
    process.exit(0);
  };

  process.on('SIGINT', onStop);
  process.on('SIGTERM', onStop);

  while (count < maxCount) {
    count++;
    const roll = Math.random() * 100;
    const status = roll < okRatio ? 'OK' : 'NG';

    try {
      await sendMachineResult(status, machineId);
      if (status === 'OK') okCount++;
      else ngCount++;
    } catch {
      log('WARN', `Will retry on next cycle in ${intervalMs} ms...`);
    }

    if (count < maxCount) {
      await sleep(intervalMs);
    }
  }

  onStop();
}

// ==========================================
// Interactive CLI Mode
// ==========================================
function startInteractivePrompt() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`\n${colors.cyan}${colors.bold}======================================================${colors.reset}`);
  console.log(`${colors.bold}      Mock OPC UA Client (Industrial PC Simulator)     ${colors.reset}`);
  console.log(`${colors.cyan}======================================================${colors.reset}`);
  console.log(`Backend Target : ${API_BASE_URL}/machine-results`);
  console.log(`Machine ID     : ${DEFAULT_MACHINE_ID}`);
  console.log(`Schema Format  : { machineId, status: "OK"|"NG", timestamp }\n`);
  console.log('Available Actions:');
  console.log('  1) Send OK result');
  console.log('  2) Send NG result');
  console.log('  3) Send custom result (specify machine ID & status)');
  console.log('  4) Start periodic simulation loop (continuous)');
  console.log('  5) Fetch current machine statistics from backend');
  console.log('  0) Exit\n');

  rl.question(`${colors.bold}Select option [1-5, 0]: ${colors.reset}`, async (choice) => {
    const trimmed = choice.trim();

    try {
      switch (trimmed) {
        case '1':
          await sendMachineResult('OK', DEFAULT_MACHINE_ID);
          break;
        case '2':
          await sendMachineResult('NG', DEFAULT_MACHINE_ID);
          break;
        case '3':
          rl.question(`Enter Machine ID (default: ${DEFAULT_MACHINE_ID}): `, (mId) => {
            const chosenId = mId.trim() || DEFAULT_MACHINE_ID;
            rl.question('Enter Status (OK / NG): ', async (st) => {
              rl.close();
              try {
                await sendMachineResult(st, chosenId);
              } catch {
                // logged already
              }
              startInteractivePrompt();
            });
          });
          return;
        case '4':
          rl.close();
          await runPeriodicSimulation({
            machineId: DEFAULT_MACHINE_ID,
            intervalMs: 2000,
            okRatio: 85,
          });
          return;
        case '5': {
          const res = await request('GET', `/machine-results/summary?machineId=${DEFAULT_MACHINE_ID}`);
          if (res.status === 200 && res.body?.success) {
            console.log(`\n${colors.cyan}${colors.bold}Station Summary (${DEFAULT_MACHINE_ID}):${colors.reset}`);
            console.log(JSON.stringify(res.body.data, null, 2));
          } else {
            log('ERROR', `Could not fetch stats: ${JSON.stringify(res.body)}`);
          }
          break;
        }
        case '0':
        case 'exit':
        case 'q':
          console.log('\nExiting Mock OPC UA Client. Goodbye!\n');
          rl.close();
          process.exit(0);
        default:
          console.log(`${colors.yellow}Invalid option. Please enter a number between 0 and 5.${colors.reset}`);
      }
    } catch {
      // Error handled and logged inside sendMachineResult
    }

    rl.close();
    startInteractivePrompt();
  });
}

// ==========================================
// CLI Argument Parser & Entrypoint
// ==========================================
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
${colors.bold}Mock OPC UA Client Simulator — PT Sankei Gohsyu Industries${colors.reset}

${colors.bold}DESCRIPTION${colors.reset}
  Simulates an OPC UA Client on an Industrial PC reading machine inspection outcomes
  and forwarding { machineId, status, timestamp } to the Node.js backend.

${colors.bold}USAGE${colors.reset}
  node index.js [options]

${colors.bold}OPTIONS${colors.reset}
  --ok                    Send a single "OK" machine result and exit
  --ng                    Send a single "NG" machine result and exit
  --status <OK|NG>        Send a specific inspection status
  --machine <id>          Set machine ID (default: "MACHINE-01")
  --url <url>             Set backend API URL (default: "http://localhost:3000/api/v1")
  --periodic, -p          Run periodic inspection result generator
  --continuous, -c        Alias for --periodic
  --interval <ms>         Interval in milliseconds for periodic mode (default: 2000)
  --ratio <percentage>    Target OK percentage in periodic mode (default: 85)
  --count <n>             Send exactly n results in periodic mode, then exit
  --help, -h              Show this help menu

${colors.bold}ENVIRONMENT VARIABLES${colors.reset}
  BACKEND_URL             Backend base URL (e.g. "http://localhost:3000/api/v1")
  BACKEND_HOST            Backend host (default: "localhost")
  BACKEND_PORT            Backend port (default: "3000")
  MACHINE_ID              Default machine identifier (default: "MACHINE-01")

${colors.bold}EXAMPLES${colors.reset}
  # Send single OK result:
  node index.js --ok

  # Send single NG result:
  node index.js --ng

  # Send OK result for specific machine:
  node index.js --ok --machine MACHINE-02

  # Send result to custom backend URL:
  BACKEND_URL=http://localhost:3000 node index.js --ok

  # Run continuous inspection simulation every 2 seconds:
  node index.js --periodic --interval 2000

  # Run interactive menu:
  node index.js
`);
    process.exit(0);
  }

  // Parse custom URL if provided
  const urlIdx = args.indexOf('--url');
  if (urlIdx !== -1 && args[urlIdx + 1]) {
    process.env.BACKEND_URL = args[urlIdx + 1];
    API_BASE_URL = resolveApiBaseUrl();
  }

  // Parse custom Machine ID if provided
  const machineIdx = args.indexOf('--machine') !== -1 ? args.indexOf('--machine') : args.indexOf('--machineId');
  if (machineIdx !== -1 && args[machineIdx + 1]) {
    DEFAULT_MACHINE_ID = args[machineIdx + 1].trim();
  }

  // 1. Single OK send
  if (args.includes('--ok') || args.includes('--pass')) {
    try {
      await sendMachineResult('OK', DEFAULT_MACHINE_ID);
      process.exit(0);
    } catch {
      process.exit(1);
    }
  }

  // 2. Single NG send
  if (args.includes('--ng') || args.includes('--fail')) {
    try {
      await sendMachineResult('NG', DEFAULT_MACHINE_ID);
      process.exit(0);
    } catch {
      process.exit(1);
    }
  }

  // 3. Custom status send
  const statusIdx = args.indexOf('--status');
  if (statusIdx !== -1 && args[statusIdx + 1]) {
    try {
      await sendMachineResult(args[statusIdx + 1], DEFAULT_MACHINE_ID);
      process.exit(0);
    } catch {
      process.exit(1);
    }
  }

  // 4. Periodic / Continuous simulation
  if (args.includes('--periodic') || args.includes('-p') || args.includes('--continuous') || args.includes('-c')) {
    const intervalIdx = args.indexOf('--interval');
    const intervalMs = intervalIdx !== -1 && args[intervalIdx + 1] ? parseInt(args[intervalIdx + 1], 10) : 2000;

    const ratioIdx = args.indexOf('--ratio');
    const okRatio = ratioIdx !== -1 && args[ratioIdx + 1] ? parseInt(args[ratioIdx + 1], 10) : 85;

    const countIdx = args.indexOf('--count');
    const maxCount = countIdx !== -1 && args[countIdx + 1] ? parseInt(args[countIdx + 1], 10) : Infinity;

    await runPeriodicSimulation({
      machineId: DEFAULT_MACHINE_ID,
      intervalMs,
      okRatio,
      maxCount,
    });
    return;
  }

  // 5. Default: Launch interactive menu
  startInteractivePrompt();
}

main().catch((err) => {
  log('ERROR', `Fatal unexpected exception: ${err.message}`);
  process.exit(1);
});
