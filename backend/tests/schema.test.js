/**
 * Database Schema Integration Tests
 * 
 * Verifies PostgreSQL schema rules for `machine_results`:
 * 1. Table `machine_results` exists.
 * 2. Columns: id, machine_id, status, timestamp, created_at.
 * 3. NOT NULL constraints on machine_id, status, timestamp, created_at.
 * 4. CHECK constraint: status only allows 'OK' and 'NG'.
 * 5. Indexes: idx_machine_results_machine_id, idx_machine_results_status, idx_machine_results_timestamp.
 * 6. SQL-level violation tests:
 *    - Invalid status ('PASS', 'INVALID') rejected by CHECK constraint.
 *    - NULL machine_id rejected by NOT NULL constraint.
 *    - NULL timestamp rejected by NOT NULL constraint.
 *    - Valid 'OK' and 'NG' inserts succeed.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'sankei_db',
  user: process.env.POSTGRES_USER || 'sankei_user',
  password: process.env.POSTGRES_PASSWORD || 'sankei_password',
  connectionTimeoutMillis: 3000,
});

describe('PostgreSQL Schema — machine_results', () => {
  let dbConnected = false;

  before(async () => {
    try {
      const client = await pool.connect();
      client.release();
      dbConnected = true;
    } catch (err) {
      console.warn('[schema.test.js] Database not directly reachable on host:', err.message);
      dbConnected = false;
    }
  });

  after(async () => {
    await pool.end().catch(() => {});
  });

  test('1. Table machine_results must exist', async (t) => {
    if (!dbConnected) return t.skip('Database not directly reachable from test runner');

    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'machine_results'
    `);
    assert.strictEqual(res.rowCount, 1, 'Table machine_results must exist in public schema');
  });

  test('2. Required columns and NOT NULL constraints', async (t) => {
    if (!dbConnected) return t.skip('Database not directly reachable from test runner');

    const res = await pool.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_name = 'machine_results'
    `);

    const colMap = new Map(res.rows.map(r => [r.column_name, r]));

    // Check id
    assert.ok(colMap.has('id'), 'Column id must exist');
    assert.strictEqual(colMap.get('id').is_nullable, 'NO', 'id must not be nullable');

    // Check machine_id
    assert.ok(colMap.has('machine_id'), 'Column machine_id must exist');
    assert.strictEqual(colMap.get('machine_id').is_nullable, 'NO', 'machine_id must not be nullable');

    // Check status
    assert.ok(colMap.has('status'), 'Column status must exist');
    assert.strictEqual(colMap.get('status').is_nullable, 'NO', 'status must not be nullable');

    // Check timestamp
    assert.ok(colMap.has('timestamp'), 'Column timestamp must exist');
    assert.strictEqual(colMap.get('timestamp').is_nullable, 'NO', 'timestamp must not be nullable');

    // Check created_at
    assert.ok(colMap.has('created_at'), 'Column created_at must exist');
    assert.strictEqual(colMap.get('created_at').is_nullable, 'NO', 'created_at must not be nullable');
  });

  test('3. Required indexes must exist for machine_id, status, and timestamp', async (t) => {
    if (!dbConnected) return t.skip('Database not directly reachable from test runner');

    const res = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'machine_results'
    `);

    const indexNames = res.rows.map(r => r.indexname);

    assert.ok(indexNames.includes('idx_machine_results_machine_id'), 'Index idx_machine_results_machine_id must exist');
    assert.ok(indexNames.includes('idx_machine_results_status'), 'Index idx_machine_results_status must exist');
    assert.ok(indexNames.includes('idx_machine_results_timestamp'), 'Index idx_machine_results_timestamp must exist');
  });

  test('4. CHECK constraint: status must reject invalid values (e.g. PASS, FAIL, INVALID)', async (t) => {
    if (!dbConnected) return t.skip('Database not directly reachable from test runner');

    await assert.rejects(
      async () => {
        await pool.query(`
          INSERT INTO machine_results (machine_id, status, timestamp)
          VALUES ('TEST-MACHINE', 'PASS', NOW())
        `);
      },
      (err) => {
        // PostgreSQL error code 23514 is check_violation
        assert.strictEqual(err.code, '23514', 'Must violate check constraint machine_results_status_check');
        return true;
      }
    );
  });

  test('5. NOT NULL constraint: machine_id must reject NULL', async (t) => {
    if (!dbConnected) return t.skip('Database not directly reachable from test runner');

    await assert.rejects(
      async () => {
        await pool.query(`
          INSERT INTO machine_results (machine_id, status, timestamp)
          VALUES (NULL, 'OK', NOW())
        `);
      },
      (err) => {
        // PostgreSQL error code 23502 is not_null_violation
        assert.strictEqual(err.code, '23502', 'Must violate not-null constraint on machine_id');
        return true;
      }
    );
  });

  test('6. NOT NULL constraint: timestamp must reject NULL', async (t) => {
    if (!dbConnected) return t.skip('Database not directly reachable from test runner');

    await assert.rejects(
      async () => {
        await pool.query(`
          INSERT INTO machine_results (machine_id, status, timestamp)
          VALUES ('TEST-MACHINE', 'OK', NULL)
        `);
      },
      (err) => {
        // PostgreSQL error code 23502 is not_null_violation
        assert.strictEqual(err.code, '23502', 'Must violate not-null constraint on timestamp');
        return true;
      }
    );
  });

  test('7. Database accepts valid OK and NG records', async (t) => {
    if (!dbConnected) return t.skip('Database not directly reachable from test runner');

    const okRes = await pool.query(`
      INSERT INTO machine_results (machine_id, status, timestamp)
      VALUES ('TEST-MACHINE-SCHEMA', 'OK', NOW())
      RETURNING id, machine_id, status
    `);
    assert.strictEqual(okRes.rows[0].status, 'OK');

    const ngRes = await pool.query(`
      INSERT INTO machine_results (machine_id, status, timestamp)
      VALUES ('TEST-MACHINE-SCHEMA', 'NG', NOW())
      RETURNING id, machine_id, status
    `);
    assert.strictEqual(ngRes.rows[0].status, 'NG');

    // Clean up test rows
    await pool.query(`DELETE FROM machine_results WHERE machine_id = 'TEST-MACHINE-SCHEMA'`);
  });
});
