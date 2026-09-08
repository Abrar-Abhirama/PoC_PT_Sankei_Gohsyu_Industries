import { Router, Request, Response } from 'express';
import pool from '../config/database';
import {
  VALID_MACHINE_RESULT_STATUSES,
} from '../types/machineResult';

const router = Router();

// ISO-8601 regex validator: YYYY-MM-DDTHH:mm:ss(.sss)?(Z|+/-HH:mm)
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}(:?\d{2})?)$/;

/**
 * POST /api/v1/machine-results
 * 
 * Ingests machine inspection results from C# IPC Gateway (OK / NG)
 * Updates barcode record from PROCESSING -> OK / NG
 */
router.post('/', async (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== 'object') {
    res.status(400).json({
      success: false,
      error: 'Request body must be a valid JSON object',
    });
    return;
  }

  const { barcodeId, machineId, status, timestamp } = req.body;

  // 1. Validate status (required, exactly "OK" or "NG")
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

  // 2. Validate timestamp (required, valid ISO-8601 string)
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

  // FLOW A: When barcodeId is provided (C# IPC return flow)
  if (barcodeId !== undefined && barcodeId !== null) {
    const parsedBarcodeId = typeof barcodeId === 'number' ? barcodeId : parseInt(barcodeId, 10);
    if (isNaN(parsedBarcodeId) || parsedBarcodeId <= 0) {
      res.status(400).json({
        success: false,
        error: 'barcodeId must be a valid positive integer',
      });
      return;
    }

    try {
      // Find the corresponding barcode record
      const checkQuery = `SELECT id, barcode, status FROM barcodes WHERE id = $1`;
      const checkResult = await pool.query(checkQuery, [parsedBarcodeId]);

      if (checkResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: `Barcode with id ${parsedBarcodeId} not found`,
        });
        return;
      }

      const currentBarcode = checkResult.rows[0];

      // Reject updating a barcode that is not PROCESSING
      if (currentBarcode.status !== 'PROCESSING') {
        res.status(400).json({
          success: false,
          error: `Cannot update barcode with status '${currentBarcode.status}'. Only 'PROCESSING' barcodes can be updated to '${status}'.`,
        });
        return;
      }

      // Update status to OK or NG, and store result timestamp
      const updateQuery = `
        UPDATE barcodes
        SET status = $1, updated_at = $2
        WHERE id = $3 AND status = 'PROCESSING'
        RETURNING id, barcode, status, created_at AS "createdAt", updated_at AS "updatedAt"
      `;
      const updateResult = await pool.query(updateQuery, [status, parsedDate, parsedBarcodeId]);
      const updatedRow = updateResult.rows[0];

      // Also record in machine_results table for historical audits
      const machineName = typeof machineId === 'string' && machineId.trim() ? machineId.trim() : 'MACHINE-01';
      await pool.query(
        `INSERT INTO machine_results (machine_id, status, timestamp) VALUES ($1, $2, $3)`,
        [machineName, status, parsedDate]
      );

      res.status(200).json({
        success: true,
        message: `Barcode ${updatedRow.barcode} status successfully updated to ${status}`,
        data: updatedRow,
      });
      return;
    } catch (err) {
      console.error('[machine-results] POST / error (barcode flow):', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
      return;
    }
  }

  // FLOW B: Legacy direct machineId flow (for backwards compatibility)
  if (machineId === undefined || machineId === null || typeof machineId !== 'string' || machineId.trim() === '') {
    res.status(400).json({
      success: false,
      error: 'Either barcodeId or machineId is required',
    });
    return;
  }

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
    console.error('[machine-results] POST / error (machine flow):', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/v1/machine-results/latest
 * Returns latest processed result (OK or NG) with barcode and machine information
 */
router.get('/latest', async (_req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        id, 
        barcode, 
        status, 
        updated_at AS "updatedAt", 
        created_at AS "createdAt",
        'MACHINE-01' AS "machineId"
      FROM barcodes
      WHERE status IN ('OK', 'NG')
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `;

    const result = await pool.query(query);

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
 * Returns summary counts for: Total processed, OK, NG, Pending, Processing, Yield Rate, and Latest Result
 */
const handleSummary = async (_req: Request, res: Response) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE status IN ('OK', 'NG'))::int AS "totalProcessed",
        COUNT(*)::int AS "totalBarcodes",
        COUNT(*) FILTER (WHERE status = 'OK')::int AS "okCount",
        COUNT(*) FILTER (WHERE status = 'NG')::int AS "ngCount",
        COUNT(*) FILTER (WHERE status = 'PENDING')::int AS "pendingCount",
        COUNT(*) FILTER (WHERE status = 'PROCESSING')::int AS "processingCount"
      FROM barcodes
    `;

    const latestQuery = `
      SELECT 
        id, 
        barcode, 
        status, 
        updated_at AS "updatedAt", 
        created_at AS "createdAt",
        'MACHINE-01' AS "machineId"
      FROM barcodes
      WHERE status IN ('OK', 'NG')
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `;

    const [statsRes, latestRes] = await Promise.all([
      pool.query(statsQuery),
      pool.query(latestQuery),
    ]);

    const row = statsRes.rows[0];
    const totalProcessed = row?.totalProcessed ?? 0;
    const okCount = row?.okCount ?? 0;
    const ngCount = row?.ngCount ?? 0;
    const pendingCount = row?.pendingCount ?? 0;
    const processingCount = row?.processingCount ?? 0;
    const yieldRate = totalProcessed > 0 ? Number(((okCount / totalProcessed) * 100).toFixed(1)) : 100.0;
    const latestResult = latestRes.rows[0] ?? null;

    res.json({
      success: true,
      data: {
        total: totalProcessed,
        totalProcessed,
        totalBarcodes: row?.totalBarcodes ?? 0,
        okCount,
        ngCount,
        pendingCount,
        processingCount,
        yieldRate,
        latestResult,
      },
    });
  } catch (err) {
    console.error('[machine-results] GET /summary error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

router.get('/summary', handleSummary);
router.get('/stats', handleSummary);

/**
 * GET /api/v1/machine-results/next-barcode
 */
router.get('/next-barcode', async (_req: Request, res: Response) => {
  try {
    const updateQuery = `
      WITH next_item AS (
        SELECT id
        FROM barcodes
        WHERE status = 'PENDING'
        ORDER BY id ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE barcodes b
      SET status = 'PROCESSING', updated_at = NOW()
      FROM next_item
      WHERE b.id = next_item.id
      RETURNING b.id, b.barcode;
    `;

    const result = await pool.query<{ id: number; barcode: string }>(updateQuery);

    if (result.rows.length === 0) {
      res.status(200).json(null);
      return;
    }

    const row = result.rows[0];
    res.status(200).json({
      id: row.id,
      barcode: row.barcode,
    });
  } catch (err) {
    console.error('[machine-results] GET /next-barcode error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/machine-results/barcodes/mock
 */
router.post('/barcodes/mock', async (req: Request, res: Response) => {
  try {
    const count = Math.min(Math.max(parseInt(req.body?.count as string, 10) || 20, 1), 500);

    const seedQuery = `
      INSERT INTO barcodes (barcode, status)
      SELECT 
        'PART_R_ID' || to_char(NOW(), 'YYYYMMDDHH24MISS') || '_' || lpad(i::text, 4, '0'),
        'PENDING'
      FROM generate_series(1, $1) AS s(i)
      RETURNING id, barcode, status, created_at AS "createdAt";
    `;

    const result = await pool.query(seedQuery, [count]);
    res.status(201).json({
      success: true,
      message: `Successfully generated ${result.rowCount} mock PENDING barcodes`,
      count: result.rowCount,
      data: result.rows,
    });
  } catch (err) {
    console.error('[machine-results] POST /barcodes/mock error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/machine-results/barcodes
 */
router.post('/barcodes', async (req: Request, res: Response) => {
  try {
    const { barcode } = req.body;
    if (!barcode || typeof barcode !== 'string' || barcode.trim() === '') {
      res.status(400).json({ success: false, error: 'barcode is required and must be a non-empty string' });
      return;
    }

    const insertQuery = `
      INSERT INTO barcodes (barcode, status)
      VALUES ($1, 'PENDING')
      RETURNING id, barcode, status, created_at AS "createdAt", updated_at AS "updatedAt";
    `;

    const result = await pool.query(insertQuery, [barcode.trim()]);
    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    console.error('[machine-results] POST /barcodes error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/machine-results/barcodes
 */
router.get('/barcodes', async (req: Request, res: Response) => {
  try {
    const status = (req.query.status as string | undefined)?.trim();
    let query = `SELECT id, barcode, status, created_at AS "createdAt", updated_at AS "updatedAt" FROM barcodes`;
    const params: unknown[] = [];
    if (status) {
      query += ` WHERE status = $1`;
      params.push(status);
    }
    query += ` ORDER BY id DESC LIMIT 50`;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[machine-results] GET /barcodes error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/machine-results
 * Returns recent barcodes with status, timestamp, and machineId
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt((req.query.limit || req.query.pageSize) as string, 10) || 15, 1), 100);
    const offset = (page - 1) * limit;

    const status = (req.query.status as string | undefined)?.trim().toUpperCase();
    const search = (req.query.search as string | undefined)?.trim();

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status && status !== 'ALL') {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`barcode ILIKE $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*)::int AS count FROM barcodes ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const total = countResult.rows[0]?.count ?? 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const dataParams = [...params, limit, offset];
    const dataQuery = `
      SELECT 
        id, 
        barcode, 
        status, 
        updated_at AS "updatedAt", 
        created_at AS "createdAt",
        'MACHINE-01' AS "machineId"
      FROM barcodes
      ${whereClause}
      ORDER BY updated_at DESC, id DESC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `;

    const result = await pool.query(dataQuery, dataParams);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        pageSize: limit,
        total,
        totalPages,
      },
      total,
    });
  } catch (err) {
    console.error('[machine-results] GET / error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;