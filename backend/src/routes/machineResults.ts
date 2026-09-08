import { Router, Request, Response } from 'express';
import pool from '../config/database';
import {
  VALID_MACHINE_RESULT_STATUSES,
  CreateMachineResultBody,
  MachineResult,
  MachineResultStats,
} from '../types/machineResult';

const router = Router();

// ISO-8601 regex validator: YYYY-MM-DDTHH:mm:ss(.sss)?(Z|+/-HH:mm)
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}(:?\d{2})?)$/;

/**
 * POST /api/v1/machine-results
 * 
 * Ingests machine inspection results reported by the OPC UA Client.
 * 
 * Requirements:
 * 1. Validate request body.
 * 2. machineId is required (non-empty string).
 * 3. status is required and must be exactly "OK" or "NG".
 * 4. timestamp is required and must be a valid ISO-8601 timestamp.
 * 5. Returns HTTP 400 with clear JSON error for invalid requests.
 * 6. Returns HTTP 201 with success response and stored result for valid requests.
 * 7. Stores result in PostgreSQL.
 */
router.post('/', async (req: Request, res: Response) => {
  // Validate request body is an object
  if (!req.body || typeof req.body !== 'object') {
    res.status(400).json({
      success: false,
      error: 'Request body must be a valid JSON object',
    });
    return;
  }

  const { machineId, status, timestamp } = req.body as Partial<CreateMachineResultBody>;

  // 1. Validate machineId (required, non-empty string)
  if (machineId === undefined || machineId === null || typeof machineId !== 'string' || machineId.trim() === '') {
    res.status(400).json({
      success: false,
      error: 'machineId is required and must be a non-empty string',
    });
    return;
  }

  // 2. Validate status (required, exactly "OK" or "NG")
  if (status === undefined || status === null) {
    res.status(400).json({
      success: false,
      error: "status is required and must be exactly 'OK' or 'NG'",
      validStatuses: VALID_MACHINE_RESULT_STATUSES,
    });
    return;
  }

  if (status !== 'OK' && status !== 'NG') {
    res.status(400).json({
      success: false,
      error: `Invalid status '${status}'. status must be exactly 'OK' or 'NG'`,
      validStatuses: VALID_MACHINE_RESULT_STATUSES,
    });
    return;
  }

  // 3. Validate timestamp (required, valid ISO-8601 string)
  if (timestamp === undefined || timestamp === null || typeof timestamp !== 'string' || timestamp.trim() === '') {
    res.status(400).json({
      success: false,
      error: 'timestamp is required and must be a valid ISO-8601 timestamp string',
    });
    return;
  }

  const trimmedTimestamp = timestamp.trim();
  const parsedDate = new Date(trimmedTimestamp);
  if (!ISO_8601_REGEX.test(trimmedTimestamp) || isNaN(parsedDate.getTime())) {
    res.status(400).json({
      success: false,
      error: `Invalid timestamp '${timestamp}'. timestamp must be a valid ISO-8601 string (e.g. '2026-09-08T10:30:00Z')`,
    });
    return;
  }

  // 4. Store in PostgreSQL
  try {
    const insertQuery = `
      INSERT INTO machine_results (machine_id, status, timestamp)
      VALUES ($1, $2, $3)
      RETURNING id, machine_id AS "machineId", status, timestamp, created_at AS "createdAt"
    `;

    const result = await pool.query<{
      id: number;
      machineId: string;
      status: 'OK' | 'NG';
      timestamp: Date;
      createdAt: Date;
    }>(insertQuery, [machineId.trim(), status, parsedDate]);

    const row = result.rows[0];

    res.status(201).json({
      success: true,
      data: {
        id: row.id,
        machineId: row.machineId,
        status: row.status,
        timestamp: row.timestamp.toISOString(),
      },
    });
  } catch (err) {
    console.error('[machine-results] POST / error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/v1/machine-results/latest
 * 
 * Retrieve the single most recent machine inspection result.
 */
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const machineId = (req.query.machineId as string | undefined)?.trim();
    let query = `
      SELECT id, machine_id AS "machineId", status, timestamp, created_at AS "createdAt"
      FROM machine_results
    `;
    const params: unknown[] = [];
    if (machineId) {
      query += ` WHERE machine_id = $1`;
      params.push(machineId);
    }
    query += ` ORDER BY timestamp DESC, id DESC LIMIT 1`;

    const result = await pool.query<MachineResult>(query, params);

    res.json({
      success: true,
      data: result.rows[0] ?? null,
    });
  } catch (err) {
    console.error('[machine-results] GET /latest error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/machine-results/summary (and alias /stats)
 * 
 * Aggregate statistics for the dashboard (total, okCount, ngCount, yieldRate, latestResult).
 */
const handleSummary = async (req: Request, res: Response) => {
  try {
    const machineId = (req.query.machineId as string | undefined)?.trim();

    const statsQuery = `
      SELECT 
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'OK')::int AS "okCount",
        COUNT(*) FILTER (WHERE status = 'NG')::int AS "ngCount"
      FROM machine_results
      WHERE ($1::text IS NULL OR machine_id = $1)
    `;

    const latestQuery = `
      SELECT id, machine_id AS "machineId", status, timestamp, created_at AS "createdAt"
      FROM machine_results
      WHERE ($1::text IS NULL OR machine_id = $1)
      ORDER BY timestamp DESC, id DESC
      LIMIT 1
    `;

    const [statsRes, latestRes] = await Promise.all([
      pool.query<{ total: number; okCount: number; ngCount: number }>(statsQuery, [machineId ?? null]),
      pool.query<MachineResult>(latestQuery, [machineId ?? null]),
    ]);

    const total = statsRes.rows[0]?.total ?? 0;
    const okCount = statsRes.rows[0]?.okCount ?? 0;
    const ngCount = statsRes.rows[0]?.ngCount ?? 0;
    const yieldRate = total > 0 ? Number(((okCount / total) * 100).toFixed(1)) : 100.0;
    const latestResult = latestRes.rows[0] ?? null;

    const data: MachineResultStats = {
      total,
      okCount,
      ngCount,
      yieldRate,
      latestResult,
    };

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error('[machine-results] GET /summary error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

router.get('/summary', handleSummary);
router.get('/stats', handleSummary);

/**
 * GET /api/v1/machine-results
 * 
 * Retrieve recent machine inspection results.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 200);
    const machineId = (req.query.machineId as string | undefined)?.trim();

    let query = `
      SELECT id, machine_id AS "machineId", status, timestamp, created_at AS "createdAt"
      FROM machine_results
    `;
    const params: unknown[] = [];

    if (machineId) {
      query += ` WHERE machine_id = $1`;
      params.push(machineId);
    }

    query += ` ORDER BY timestamp DESC, id DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query<MachineResult>(query, params);

    res.json({
      success: true,
      data: result.rows,
      total: result.rowCount,
    });
  } catch (err) {
    console.error('[machine-results] GET / error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
