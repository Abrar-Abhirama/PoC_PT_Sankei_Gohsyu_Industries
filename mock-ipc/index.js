#!/usr/bin/env node

/**
 * Mock IPC Service for PT Sankei Gohsyu Industries QR Traceability System
 * 
 * Simulates the C# IPC Service running on the Industrial PC by making REST API
 * calls to the backend service.
 * 
 * Events simulated:
 * - PRODUCT_DETECTED
 * - PRINT_STARTED
 * - PRINT_COMPLETED
 * - QR_READ
 * - QR_READ_FAILED
 * - VISION_PASS
 * - VISION_FAIL
 * - PRODUCT_COMPLETED
 * - MACHINE_ERROR / EMERGENCY_STOP
 */

const http = require('http');
const readline = require('readline');

const BACKEND_HOST = process.env.BACKEND_HOST || 'localhost';
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || '3000', 10);
const DEFAULT_MACHINE_ID = process.env.MACHINE_ID || 'LINE-01';

// ANSI color helpers
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
 * Ensure a production order is currently RUNNING
 */
async function ensureRunningOrder() {
  const current = await apiRequest('GET', '/production/current');
  if (current.body?.data) {
    return current.body.data;
  }

  log(colors.yellow, '[ORDER]', 'No RUNNING order found. Auto-creating a mock production order...');
  const orderNum = `PO-MOCK-${Date.now().toString().slice(-6)}`;
  const createRes = await apiRequest('POST', '/production-orders', {
    order_number: orderNum,
    product_code: 'SANK-BKT-01',
    product_name: 'Muffler Stay Bracket',
    target_quantity: 100,
  });

  if (createRes.status !== 201) {
    throw new Error(`Failed to create order: ${JSON.stringify(createRes.body)}`);
  }

  const orderId = createRes.body.data.id;
  const startRes = await apiRequest('POST', '/production/start', { id: orderId });
  if (startRes.status !== 200) {
    throw new Error(`Failed to start order: ${JSON.stringify(startRes.body)}`);
  }

  log(colors.green, '[ORDER]', `Started mock order ${orderNum} (ID: ${orderId})`);
  return startRes.body.data;
}

/**
 * Update machine status
 */
async function updateMachineStatus(machineId, status, details = {}) {
  const res = await apiRequest('POST', '/ipc/status', {
    machineId,
    status,
    details,
  });
  if (res.status !== 200) {
    log(colors.red, '[STATUS]', `Failed to update status: ${res.body?.error || res.status}`);
  }
  return res;
}

/**
 * Simulate Scenario 1: Normal Product Cycle (PASS)
 */
async function simulateNormalCycle(machineId = DEFAULT_MACHINE_ID) {
  log(colors.cyan, '─── [CYCLE START]', `Simulating Normal Production Cycle on ${machineId} ───`);

  await ensureRunningOrder();
  await updateMachineStatus(machineId, 'RUNNING', { plcConnected: true, markerReady: true });

  // 1. PRODUCT_DETECTED
  log(colors.yellow, '[PLC]', '1. Proximity sensor: PRODUCT_DETECTED');
  const detectRes = await apiRequest('POST', '/ipc/events', {
    machineId,
    eventType: 'PRODUCT_DETECTED',
  });

  if (detectRes.status !== 201) {
    log(colors.red, '[ERROR]', `PRODUCT_DETECTED failed: ${JSON.stringify(detectRes.body)}`);
    return;
  }

  const serialNumber = detectRes.body.data?.serialNumber;
  log(colors.green, '[BACKEND]', `Generated Serial Number: ${colors.bright}${serialNumber}${colors.reset}`);

  // 2. PRINT_STARTED
  await sleep(400);
  log(colors.yellow, '[LASER]', `2. Laser marker triggered: PRINT_STARTED for ${serialNumber}`);
  await apiRequest('POST', '/ipc/events', {
    machineId,
    eventType: 'PRINT_STARTED',
    serialNumber,
    data: { laserPowerPercent: 95 },
  });

  // 3. PRINT_COMPLETED
  await sleep(600);
  log(colors.yellow, '[LASER]', `3. Marking finished: PRINT_COMPLETED`);
  await apiRequest('POST', '/ipc/events', {
    machineId,
    eventType: 'PRINT_COMPLETED',
    serialNumber,
    data: { markDurationMs: 620 },
  });

  // 4. QR_READ (SR-1000)
  await sleep(400);
  log(colors.cyan, '[SCANNER]', `4. Keyence SR-1000 reading QR: QR_READ`);
  const qrRes = await apiRequest('POST', '/ipc/inspection-result', {
    serialNumber,
    inspectionType: 'QR_READ',
    result: 'PASS',
    machineId,
    details: { reader: 'SR-1000', readTimeMs: 34, grade: 'A' },
  });
  log(colors.green, '[SCANNER]', `QR Read: PASS (Grade A)`);

  // 5. VISION INSPECTION (IV3)
  await sleep(400);
  log(colors.cyan, '[VISION]', `5. Keyence IV3 checking geometry: VISION_PASS`);
  const visionRes = await apiRequest('POST', '/ipc/inspection-result', {
    serialNumber,
    inspectionType: 'VISION',
    result: 'PASS',
    machineId,
    details: { camera: 'IV3-G120', similarityScore: 99.2, ok: true },
  });
  log(colors.green, '[VISION]', `Vision Inspection: PASS`);

  log(colors.green, '─── [CYCLE COMPLETE]', `Product ${serialNumber} marked and verified: PASS ✅\n`);
}

/**
 * Simulate Scenario 2: Defect - QR Code Read Failure
 */
async function simulateQrFailCycle(machineId = DEFAULT_MACHINE_ID) {
  log(colors.magenta, '─── [CYCLE START]', `Simulating QR Read Failure Cycle on ${machineId} ───`);

  await ensureRunningOrder();
  await updateMachineStatus(machineId, 'RUNNING');

  // 1. PRODUCT_DETECTED
  log(colors.yellow, '[PLC]', '1. Proximity sensor: PRODUCT_DETECTED');
  const detectRes = await apiRequest('POST', '/ipc/events', {
    machineId,
    eventType: 'PRODUCT_DETECTED',
  });
  const serialNumber = detectRes.body.data?.serialNumber;
  log(colors.green, '[BACKEND]', `Generated Serial: ${serialNumber}`);

  // 2. PRINT_STARTED & PRINT_COMPLETED
  await sleep(300);
  log(colors.yellow, '[LASER]', `2. PRINT_STARTED`);
  await apiRequest('POST', '/ipc/events', { machineId, eventType: 'PRINT_STARTED', serialNumber });
  await sleep(500);
  log(colors.yellow, '[LASER]', `3. PRINT_COMPLETED (faint mark simulated)`);
  await apiRequest('POST', '/ipc/events', { machineId, eventType: 'PRINT_COMPLETED', serialNumber });

  // 4. QR_READ_FAILED
  await sleep(400);
  log(colors.red, '[SCANNER]', `4. Keyence SR-1000 failed to decode: QR_READ_FAILED`);
  await apiRequest('POST', '/ipc/inspection-result', {
    serialNumber,
    inspectionType: 'QR_READ',
    result: 'FAIL',
    machineId,
    details: { error: 'UNREADABLE_LOW_CONTRAST', grade: 'F', readTimeMs: 150 },
  });

  log(colors.red, '─── [CYCLE COMPLETE]', `Product ${serialNumber} status: FAIL ❌ (Defect logged)\n`);
}

/**
 * Simulate Scenario 3: Defect - Vision Inspection Failure
 */
async function simulateVisionFailCycle(machineId = DEFAULT_MACHINE_ID) {
  log(colors.magenta, '─── [CYCLE START]', `Simulating Vision Defect Cycle on ${machineId} ───`);

  await ensureRunningOrder();
  await updateMachineStatus(machineId, 'RUNNING');

  // 1. Detect & Print
  const detectRes = await apiRequest('POST', '/ipc/events', { machineId, eventType: 'PRODUCT_DETECTED' });
  const serialNumber = detectRes.body.data?.serialNumber;
  log(colors.green, '[BACKEND]', `Generated Serial: ${serialNumber}`);

  await sleep(300);
  await apiRequest('POST', '/ipc/events', { machineId, eventType: 'PRINT_STARTED', serialNumber });
  await sleep(400);
  await apiRequest('POST', '/ipc/events', { machineId, eventType: 'PRINT_COMPLETED', serialNumber });

  // 2. QR Read PASS
  await sleep(300);
  log(colors.green, '[SCANNER]', `QR Read: PASS`);
  await apiRequest('POST', '/ipc/inspection-result', {
    serialNumber,
    inspectionType: 'QR_READ',
    result: 'PASS',
    machineId,
  });

  // 3. Vision FAIL
  await sleep(400);
  log(colors.red, '[VISION]', `Keyence IV3 detected scratch/dent: VISION_FAIL`);
  await apiRequest('POST', '/ipc/inspection-result', {
    serialNumber,
    inspectionType: 'VISION',
    result: 'FAIL',
    machineId,
    details: { defectType: 'SURFACE_SCRATCH', confidence: 0.96 },
  });

  log(colors.red, '─── [CYCLE COMPLETE]', `Product ${serialNumber} status: FAIL ❌ (Surface scratch)\n`);
}

/**
 * Simulate Scenario 4: Machine Error / Emergency Stop
 */
async function simulateMachineError(machineId = DEFAULT_MACHINE_ID) {
  log(colors.red, '─── [ALARM]', `Simulating Machine Alarm on ${machineId} ───`);

  log(colors.red, '[PLC]', 'Laser shutter interlock opened: MACHINE_ERROR');
  await apiRequest('POST', '/ipc/events', {
    machineId,
    eventType: 'MACHINE_ERROR',
    data: {
      errorCode: 'E-4012',
      description: 'Laser safety interlock open',
      severity: 'CRITICAL',
    },
  });

  await updateMachineStatus(machineId, 'ERROR', {
    errorCode: 'E-4012',
    interlockOpen: true,
  });

  log(colors.red, '[MACHINE]', `Machine ${machineId} status changed to: ERROR ⚠️\n`);
}

/**
 * Simulate Scenario 5: Single Event
 */
async function simulateSingleEvent(eventType, machineId = DEFAULT_MACHINE_ID, serialNumber = null) {
  log(colors.cyan, '[EVENT]', `Sending single event '${eventType}' for ${machineId}...`);
  const res = await apiRequest('POST', '/ipc/events', {
    machineId,
    eventType,
    serialNumber,
    data: { simulated: true, timestamp: new Date().toISOString() },
  });

  if (res.status === 201) {
    log(colors.green, '[SUCCESS]', `Event recorded (ID: ${res.body.data?.eventId})`);
  } else {
    log(colors.red, '[ERROR]', `HTTP ${res.status}: ${res.body?.error || JSON.stringify(res.body)}`);
  }
}

/**
 * Continuous Simulation Loop
 */
async function runContinuousSimulation(machineId = DEFAULT_MACHINE_ID, intervalMs = 2500) {
  console.log(`\n${colors.bright}${colors.cyan}Starting Continuous Mock IPC Simulation on ${machineId}${colors.reset}`);
  console.log(`${colors.gray}Interval: ${intervalMs}ms. Press Ctrl+C to stop.\n${colors.reset}`);

  let count = 0;
  let passCount = 0;
  let failCount = 0;

  const onExit = async () => {
    console.log(`\n${colors.yellow}Stopping simulation... Total: ${count} (Pass: ${passCount}, Fail: ${failCount})${colors.reset}`);
    process.exit(0);
  };
  process.on('SIGINT', onExit);
  process.on('SIGTERM', onExit);

  while (true) {
    count++;
    const roll = Math.random();

    try {
      if (roll < 0.88) {
        // 88% PASS
        await simulateNormalCycle(machineId);
        passCount++;
      } else if (roll < 0.94) {
        // 6% QR Fail
        await simulateQrFailCycle(machineId);
        failCount++;
      } else {
        // 6% Vision Fail
        await simulateVisionFailCycle(machineId);
        failCount++;
      }
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

  console.log(`\n${colors.bright}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bright}   Sankei Gohsyu Industries — Mock IPC Simulator   ${colors.reset}`);
  console.log(`${colors.cyan}====================================================${colors.reset}`);
  console.log(`Target Backend: http://${BACKEND_HOST}:${BACKEND_PORT}/api/v1`);
  console.log(`Target Machine: ${DEFAULT_MACHINE_ID}\n`);
  console.log('Select a simulation scenario:');
  console.log('  1) Run 1 Normal Cycle (PASS)');
  console.log('  2) Run 1 Defect Cycle (QR Read FAIL)');
  console.log('  3) Run 1 Defect Cycle (Vision Inspection FAIL)');
  console.log('  4) Simulate Machine Error (E-4012 Alarm)');
  console.log('  5) Reset Machine to RUNNING');
  console.log('  6) Run Continuous Simulation Loop (Press Ctrl+C to stop)');
  console.log('  0) Exit\n');

  rl.question('Enter option [1-6, 0]: ', async (ans) => {
    rl.close();
    const choice = ans.trim();

    try {
      switch (choice) {
        case '1':
          await simulateNormalCycle(DEFAULT_MACHINE_ID);
          break;
        case '2':
          await simulateQrFailCycle(DEFAULT_MACHINE_ID);
          break;
        case '3':
          await simulateVisionFailCycle(DEFAULT_MACHINE_ID);
          break;
        case '4':
          await simulateMachineError(DEFAULT_MACHINE_ID);
          break;
        case '5':
          await updateMachineStatus(DEFAULT_MACHINE_ID, 'RUNNING');
          log(colors.green, '[STATUS]', `Machine ${DEFAULT_MACHINE_ID} status set to RUNNING`);
          break;
        case '6':
          await runContinuousSimulation(DEFAULT_MACHINE_ID, 2500);
          return;
        case '0':
          console.log('Bye!');
          process.exit(0);
        default:
          console.log(colors.yellow + 'Invalid option.' + colors.reset);
      }
    } catch (err) {
      log(colors.red, '[ERROR]', err.message);
    }

    // Return to menu
    showInteractiveMenu();
  });
}

// CLI Argument Parsing
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node mock-ipc/index.js [options]

Options:
  --cycle, --pass       Run a single normal production cycle (PASS)
  --fail-qr             Run a cycle with QR Read failure (FAIL)
  --fail-vision         Run a cycle with Vision Inspection failure (FAIL)
  --error               Simulate a machine error / alarm
  --status <status>     Update machine status (RUNNING, STOPPED, ERROR)
  --continuous, -c      Run continuous simulation loop
  --interval <ms>       Loop interval in ms (default: 2500)
  --machine <id>        Machine ID to target (default: LINE-01)
  --event <type>        Send a specific single machine event
  --help, -h            Show this help text

Examples:
  node mock-ipc/index.js --cycle
  node mock-ipc/index.js --fail-qr
  node mock-ipc/index.js --continuous --interval 2000
  node mock-ipc/index.js --event MACHINE_ERROR
`);
    process.exit(0);
  }

  const machineIndex = args.indexOf('--machine');
  const machineId = machineIndex !== -1 && args[machineIndex + 1] ? args[machineIndex + 1] : DEFAULT_MACHINE_ID;

  if (args.includes('--cycle') || args.includes('--pass')) {
    await simulateNormalCycle(machineId);
    process.exit(0);
  }

  if (args.includes('--fail-qr')) {
    await simulateQrFailCycle(machineId);
    process.exit(0);
  }

  if (args.includes('--fail-vision')) {
    await simulateVisionFailCycle(machineId);
    process.exit(0);
  }

  if (args.includes('--error')) {
    await simulateMachineError(machineId);
    process.exit(0);
  }

  const statusIdx = args.indexOf('--status');
  if (statusIdx !== -1 && args[statusIdx + 1]) {
    await updateMachineStatus(machineId, args[statusIdx + 1].toUpperCase());
    log(colors.green, '[STATUS]', `Machine ${machineId} status updated to ${args[statusIdx + 1].toUpperCase()}`);
    process.exit(0);
  }

  const eventIdx = args.indexOf('--event');
  if (eventIdx !== -1 && args[eventIdx + 1]) {
    await simulateSingleEvent(args[eventIdx + 1].toUpperCase(), machineId);
    process.exit(0);
  }

  if (args.includes('--continuous') || args.includes('-c')) {
    const intervalIdx = args.indexOf('--interval');
    const interval = intervalIdx !== -1 && args[intervalIdx + 1] ? parseInt(args[intervalIdx + 1], 10) : 2500;
    await runContinuousSimulation(machineId, interval);
    return;
  }

  // If no CLI args provided, launch interactive menu
  showInteractiveMenu();
}

main().catch((err) => {
  console.error(colors.red + 'Fatal Error: ' + err.message + colors.reset);
  process.exit(1);
});
