/**
 * Automated Tests for POST /api/v1/machine-results
 * 
 * Test Scenarios:
 * 1. Valid request with status "OK"
 * 2. Valid request with status "NG"
 * 3. Invalid status (e.g. "PASS", "FAIL", "UNKNOWN")
 * 4. Missing machineId (undefined, null, or empty string)
 * 5. Missing status
 * 6. Invalid timestamp (malformed date string, non-ISO-8601)
 * 7. Missing timestamp
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000/api/v1';

function post(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`);
    const payload = JSON.stringify(body);
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

describe('POST /api/v1/machine-results', () => {
  // Test 1: Valid OK
  test('1. Should succeed for valid request with status OK', async () => {
    const timestamp = '2026-09-08T10:30:00Z';
    const res = await post('/machine-results', {
      machineId: 'MACHINE-01',
      status: 'OK',
      timestamp,
    });

    assert.strictEqual(res.status, 201, 'Should return HTTP 201 Created');
    assert.strictEqual(res.body.success, true, 'Should have success: true');
    assert.ok(res.body.data, 'Should have data object');
    assert.ok(res.body.data.id, 'Should have generated id');
    assert.strictEqual(res.body.data.machineId, 'MACHINE-01');
    assert.strictEqual(res.body.data.status, 'OK');
    assert.strictEqual(new Date(res.body.data.timestamp).toISOString(), new Date(timestamp).toISOString());
  });

  // Test 2: Valid NG
  test('2. Should succeed for valid request with status NG', async () => {
    const timestamp = '2026-09-08T10:35:00Z';
    const res = await post('/machine-results', {
      machineId: 'MACHINE-02',
      status: 'NG',
      timestamp,
    });

    assert.strictEqual(res.status, 201, 'Should return HTTP 201 Created');
    assert.strictEqual(res.body.success, true, 'Should have success: true');
    assert.ok(res.body.data, 'Should have data object');
    assert.ok(res.body.data.id, 'Should have generated id');
    assert.strictEqual(res.body.data.machineId, 'MACHINE-02');
    assert.strictEqual(res.body.data.status, 'NG');
    assert.strictEqual(new Date(res.body.data.timestamp).toISOString(), new Date(timestamp).toISOString());
  });

  // Test 3: Invalid status
  test('3. Should return HTTP 400 for invalid status (e.g. PASS)', async () => {
    const res = await post('/machine-results', {
      machineId: 'MACHINE-01',
      status: 'PASS',
      timestamp: '2026-09-08T10:30:00Z',
    });

    assert.strictEqual(res.status, 400, 'Should return HTTP 400 Bad Request');
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /status must be exactly 'OK' or 'NG'/i);
  });

  test('3b. Should return HTTP 400 for invalid status (e.g. FAIL)', async () => {
    const res = await post('/machine-results', {
      machineId: 'MACHINE-01',
      status: 'FAIL',
      timestamp: '2026-09-08T10:30:00Z',
    });

    assert.strictEqual(res.status, 400, 'Should return HTTP 400 Bad Request');
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /status must be exactly 'OK' or 'NG'/i);
  });

  // Test 4: Missing machineId
  test('4. Should return HTTP 400 when machineId is missing', async () => {
    const res = await post('/machine-results', {
      status: 'OK',
      timestamp: '2026-09-08T10:30:00Z',
    });

    assert.strictEqual(res.status, 400, 'Should return HTTP 400 Bad Request');
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /machineId is required/i);
  });

  test('4b. Should return HTTP 400 when machineId is empty string', async () => {
    const res = await post('/machine-results', {
      machineId: '   ',
      status: 'OK',
      timestamp: '2026-09-08T10:30:00Z',
    });

    assert.strictEqual(res.status, 400, 'Should return HTTP 400 Bad Request');
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /machineId is required/i);
  });

  // Test 5: Missing status
  test('5. Should return HTTP 400 when status is missing', async () => {
    const res = await post('/machine-results', {
      machineId: 'MACHINE-01',
      timestamp: '2026-09-08T10:30:00Z',
    });

    assert.strictEqual(res.status, 400, 'Should return HTTP 400 Bad Request');
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /status is required/i);
  });

  // Test 6: Invalid timestamp
  test('6. Should return HTTP 400 for invalid/malformed timestamp', async () => {
    const res = await post('/machine-results', {
      machineId: 'MACHINE-01',
      status: 'OK',
      timestamp: 'not-a-timestamp',
    });

    assert.strictEqual(res.status, 400, 'Should return HTTP 400 Bad Request');
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /invalid timestamp/i);
  });

  // Test 7: Missing timestamp
  test('7. Should return HTTP 400 when timestamp is missing', async () => {
    const res = await post('/machine-results', {
      machineId: 'MACHINE-01',
      status: 'OK',
    });

    assert.strictEqual(res.status, 400, 'Should return HTTP 400 Bad Request');
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /timestamp is required/i);
  });
});
