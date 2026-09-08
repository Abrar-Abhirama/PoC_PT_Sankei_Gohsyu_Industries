import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { generateSerialNumber } from '../services/serialNumber';
import type {
  Product,
  InspectionRecord,
  ProductTraceability,
  TraceabilityTimelineItem,
} from '../types/product';
import type { ProductionOrder } from '../types/productionOrder';

const router = Router();

// POST /api/v1/products
// Registers a new product for an active (RUNNING) production order.
// Generates a unique serial number automatically.
router.post('/', async (req: Request, res: Response) => {
  const { production_order_id, machine_id } = req.body as {
    production_order_id?: number;
    machine_id?: number;
  };

  if (!production_order_id || !Number.isInteger(production_order_id) || production_order_id <= 0) {
    res.status(400).json({ error: 'production_order_id is required and must be a positive integer' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify production order exists and is RUNNING
    const orderResult = await client.query<ProductionOrder>(
      `SELECT * FROM production_orders WHERE id = $1 FOR UPDATE`,
      [production_order_id]
    );
    if (orderResult.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: `Production order ${production_order_id} not found` });
      return;
    }
    if (orderResult.rows[0].status !== 'RUNNING') {
      await client.query('ROLLBACK');
      res.status(409).json({
        error: `Products can only be created for RUNNING orders. Current status: '${orderResult.rows[0].status}'`,
      });
      return;
    }

    // Validate machine_id exists if provided
    if (machine_id !== undefined && machine_id !== null) {
      if (!Number.isInteger(machine_id) || machine_id <= 0) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'machine_id must be a positive integer' });
        return;
      }
      const machineCheck = await client.query(`SELECT id FROM machines WHERE id = $1`, [machine_id]);
      if (machineCheck.rowCount === 0) {
        await client.query('ROLLBACK');
        res.status(404).json({ error: `Machine ${machine_id} not found` });
        return;
      }
    }

    // Generate serial number atomically
    const { serialNumber } = await generateSerialNumber(client);

    // Insert the product
    const productResult = await client.query<Product>(
      `INSERT INTO products (serial_number, production_order_id, machine_id, status)
       VALUES ($1, $2, $3, 'IN_PROGRESS')
       RETURNING *`,
      [serialNumber, production_order_id, machine_id ?? null]
    );

    await client.query('COMMIT');
    res.status(201).json({ data: productResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[products] POST / error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/v1/products/:serialNumber/traceability
// Retrieve complete chronological traceability history for a product.
router.get('/:serialNumber/traceability', async (req: Request, res: Response) => {
  const serialNumber = req.params.serialNumber?.trim();

  if (!serialNumber) {
    res.status(400).json({ error: 'serialNumber parameter is required' });
    return;
  }

  try {
    // 1. Fetch Product with joined Production Order and Machine details
    const productRes = await pool.query<{
      id: number;
      serial_number: string;
      status: Product['status'];
      created_at: Date;
      completed_at: Date | null;
      production_order_id: number;
      order_number: string;
      product_code: string;
      product_name: string;
      target_quantity: number;
      order_status: string;
      order_created_at: Date;
      machine_id: number | null;
      machine_code: string | null;
      machine_name: string | null;
      machine_status: string | null;
    }>(
      `SELECT 
         p.id,
         p.serial_number,
         p.status,
         p.created_at,
         p.completed_at,
         p.production_order_id,
         po.order_number,
         po.product_code,
         po.product_name,
         po.target_quantity,
         po.status AS order_status,
         po.created_at AS order_created_at,
         p.machine_id,
         m.machine_code,
         m.name AS machine_name,
         m.status AS machine_status
       FROM products p
       JOIN production_orders po ON po.id = p.production_order_id
       LEFT JOIN machines m ON m.id = p.machine_id
       WHERE p.serial_number = $1`,
      [serialNumber]
    );

    if (productRes.rowCount === 0) {
      res.status(404).json({ error: `Product with serial number '${serialNumber}' not found` });
      return;
    }

    const row = productRes.rows[0];

    // 2. Fetch all machine events associated with this product
    const eventsRes = await pool.query<{
      id: number;
      event_type: string;
      event_data: Record<string, unknown> | null;
      timestamp: Date;
    }>(
      `SELECT id, event_type, event_data, timestamp
       FROM machine_events
       WHERE product_id = $1
       ORDER BY timestamp ASC, id ASC`,
      [row.id]
    );

    // 3. Fetch all inspections associated with this product
    const inspectionsRes = await pool.query<{
      id: number;
      product_id: number;
      inspection_type: 'QR_READ' | 'VISION';
      result: 'PASS' | 'FAIL';
      details: Record<string, unknown> | null;
      timestamp: Date;
    }>(
      `SELECT id, product_id, inspection_type, result, details, timestamp
       FROM inspections
       WHERE product_id = $1
       ORDER BY timestamp ASC, id ASC`,
      [row.id]
    );

    // 4. Determine key inspection results
    let qrReadingResult: {
      result: 'PASS' | 'FAIL' | null;
      timestamp: string | null;
      details: Record<string, unknown> | null;
    } = { result: null, timestamp: null, details: null };

    let visionInspectionResult: {
      result: 'PASS' | 'FAIL' | null;
      timestamp: string | null;
      details: Record<string, unknown> | null;
    } = { result: null, timestamp: null, details: null };

    for (const insp of inspectionsRes.rows) {
      if (insp.inspection_type === 'QR_READ') {
        qrReadingResult = {
          result: insp.result,
          timestamp: insp.timestamp.toISOString(),
          details: insp.details,
        };
      } else if (insp.inspection_type === 'VISION') {
        visionInspectionResult = {
          result: insp.result,
          timestamp: insp.timestamp.toISOString(),
          details: insp.details,
        };
      }
    }

    // 5. Build unified chronological timeline
    type RawTimelineEntry = {
      timestamp: Date;
      source: 'EVENT' | 'INSPECTION';
      title: string;
      description: string;
      status: 'INFO' | 'PASS' | 'FAIL' | 'ERROR';
      details?: Record<string, unknown> | null;
    };

    const rawEntries: RawTimelineEntry[] = [];

    // Map machine events to timeline entries
    for (const ev of eventsRes.rows) {
      let status: 'INFO' | 'PASS' | 'FAIL' | 'ERROR' = 'INFO';
      let description = '';

      switch (ev.event_type) {
        case 'PRODUCT_DETECTED':
          description = `Product detected by line proximity sensor at ${row.machine_code || 'station'}`;
          break;
        case 'PRINT_STARTED':
          description = `Laser marker triggered: started QR code printing`;
          break;
        case 'PRINT_COMPLETED':
          description = `Laser marking completed successfully`;
          break;
        case 'PRINT_FAILED':
          status = 'ERROR';
          description = `Laser marker reported marking failure`;
          break;
        case 'QR_READ':
          status = 'PASS';
          description = `Keyence SR-1000 scanner successfully decoded QR code`;
          break;
        case 'QR_READ_FAILED':
          status = 'FAIL';
          description = `Keyence SR-1000 scanner failed to read QR code`;
          break;
        case 'VISION_PASS':
          status = 'PASS';
          description = `Keyence IV3 visual inspection confirmed geometry and surface OK`;
          break;
        case 'VISION_FAIL':
          status = 'FAIL';
          description = `Keyence IV3 visual inspection detected surface or dimensional defect`;
          break;
        case 'PRODUCT_COMPLETED':
          status = row.status === 'FAIL' ? 'FAIL' : 'PASS';
          description = `Product production cycle finished with status: ${row.status}`;
          break;
        case 'MACHINE_ERROR':
        case 'EMERGENCY_STOP':
          status = 'ERROR';
          description = `Machine reported error: ${JSON.stringify(ev.event_data)}`;
          break;
        default:
          description = `Machine event: ${ev.event_type}`;
      }

      rawEntries.push({
        timestamp: ev.timestamp,
        source: 'EVENT',
        title: ev.event_type,
        description,
        status,
        details: ev.event_data,
      });
    }

    // Map inspections to timeline entries (if not already represented by specific events)
    for (const insp of inspectionsRes.rows) {
      // Check if an event already logged this exact inspection at the same second
      const alreadyHasEvent = rawEntries.some(
        (e) =>
          (e.title === insp.inspection_type ||
            e.title === `${insp.inspection_type}_PASS` ||
            e.title === `${insp.inspection_type}_FAIL`) &&
          Math.abs(e.timestamp.getTime() - insp.timestamp.getTime()) < 1000
      );

      if (!alreadyHasEvent) {
        rawEntries.push({
          timestamp: insp.timestamp,
          source: 'INSPECTION',
          title: `${insp.inspection_type} — ${insp.result}`,
          description:
            insp.inspection_type === 'QR_READ'
              ? `Keyence SR-1000 QR verification: ${insp.result}`
              : `Keyence IV3 vision inspection: ${insp.result}`,
          status: insp.result === 'PASS' ? 'PASS' : 'FAIL',
          details: insp.details,
        });
      }
    }

    // Sort chronologically by timestamp
    rawEntries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const timeline: TraceabilityTimelineItem[] = rawEntries.map((item, idx) => ({
      step: idx + 1,
      timestamp: item.timestamp.toISOString(),
      source: item.source,
      title: item.title,
      description: item.description,
      status: item.status,
      details: item.details,
    }));

    // Calculate cycle time if completed
    let cycleTimeSeconds: number | null = null;
    if (row.completed_at && row.created_at) {
      cycleTimeSeconds = Math.round((row.completed_at.getTime() - row.created_at.getTime()) / 1000);
    }

    const traceabilityData: ProductTraceability = {
      serialNumber: row.serial_number,
      productionStatus: row.status,
      product: {
        id: row.id,
        serialNumber: row.serial_number,
        status: row.status,
        createdAt: row.created_at.toISOString(),
        completedAt: row.completed_at ? row.completed_at.toISOString() : null,
        cycleTimeSeconds,
      },
      productionOrder: {
        id: row.production_order_id,
        orderNumber: row.order_number,
        productCode: row.product_code,
        productName: row.product_name,
        targetQuantity: row.target_quantity,
        status: row.order_status,
        createdAt: row.order_created_at.toISOString(),
      },
      machine: {
        id: row.machine_id,
        machineCode: row.machine_code,
        name: row.machine_name,
        status: row.machine_status,
      },
      inspections: {
        qrReadingResult,
        visionInspectionResult,
        records: inspectionsRes.rows.map((i) => ({
          id: i.id,
          product_id: i.product_id,
          inspection_type: i.inspection_type,
          result: i.result,
          details: i.details,
          timestamp: i.timestamp.toISOString(),
        })),
      },
      machineEvents: eventsRes.rows.map((e) => ({
        id: e.id,
        eventType: e.event_type,
        eventData: e.event_data,
        timestamp: e.timestamp.toISOString(),
      })),
      timeline,
    };

    res.json({
      success: true,
      data: traceabilityData,
    });
  } catch (err) {
    console.error('[products] GET /:serialNumber/traceability error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/products/:serialNumber
// Retrieve basic product information and associated order/machine.
router.get('/:serialNumber', async (req: Request, res: Response) => {
  const serialNumber = req.params.serialNumber?.trim();

  try {
    const result = await pool.query<{
      id: number;
      serial_number: string;
      status: Product['status'];
      created_at: Date;
      completed_at: Date | null;
      production_order_id: number;
      order_number: string;
      product_code: string;
      product_name: string;
      machine_id: number | null;
      machine_code: string | null;
      machine_name: string | null;
    }>(
      `SELECT 
         p.id,
         p.serial_number,
         p.status,
         p.created_at,
         p.completed_at,
         p.production_order_id,
         po.order_number,
         po.product_code,
         po.product_name,
         p.machine_id,
         m.machine_code,
         m.name AS machine_name
       FROM products p
       JOIN production_orders po ON po.id = p.production_order_id
       LEFT JOIN machines m ON m.id = p.machine_id
       WHERE p.serial_number = $1`,
      [serialNumber]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: `Product with serial number '${serialNumber}' not found` });
      return;
    }

    const row = result.rows[0];

    // Fetch brief inspection status
    const inspRes = await pool.query<{ inspection_type: string; result: string }>(
      `SELECT inspection_type, result FROM inspections WHERE product_id = $1 ORDER BY id ASC`,
      [row.id]
    );

    res.json({
      success: true,
      data: {
        id: row.id,
        serialNumber: row.serial_number,
        status: row.status,
        createdAt: row.created_at.toISOString(),
        completedAt: row.completed_at ? row.completed_at.toISOString() : null,
        productionOrder: {
          id: row.production_order_id,
          orderNumber: row.order_number,
          productCode: row.product_code,
          productName: row.product_name,
        },
        machine: row.machine_id
          ? {
              id: row.machine_id,
              machineCode: row.machine_code,
              name: row.machine_name,
            }
          : null,
        inspections: inspRes.rows,
      },
    });
  } catch (err) {
    console.error('[products] GET /:serialNumber error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/products
// List all products, with optional filter by production_order_id.
router.get('/', async (req: Request, res: Response) => {
  const { production_order_id } = req.query;

  try {
    const values: unknown[] = [];
    let where = '';
    if (production_order_id) {
      const id = parseInt(production_order_id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'production_order_id must be a valid integer' });
        return;
      }
      where = `WHERE p.production_order_id = $1`;
      values.push(id);
    }

    const result = await pool.query<Product & { order_number: string }>(
      `SELECT p.*, po.order_number
       FROM products p
       JOIN production_orders po ON po.id = p.production_order_id
       ${where}
       ORDER BY p.created_at DESC`,
      values
    );

    res.json({ data: result.rows, total: result.rowCount });
  } catch (err) {
    console.error('[products] GET / error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
