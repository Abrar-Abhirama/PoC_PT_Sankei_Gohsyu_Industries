import { Router, Request, Response } from 'express';
import { PoolClient } from 'pg';
import pool from '../config/database';
import { generateSerialNumber } from '../services/serialNumber';
import {
  VALID_EVENT_TYPES,
  VALID_INSPECTION_TYPES,
  VALID_INSPECTION_RESULTS,
  VALID_MACHINE_STATUSES,
  MachineEventType,
  InspectionType,
  InspectionResult,
  MachineStatus,
  MachineRecord,
} from '../types/ipc';
import type { Product } from '../types/product';
import type { ProductionOrder } from '../types/productionOrder';

const router = Router();

/**
 * Helper to find a machine by code or numeric ID
 */
async function findMachine(
  db: PoolClient | typeof pool,
  identifier: string | number
): Promise<MachineRecord | null> {
  const isNumeric = typeof identifier === 'number' || /^\d+$/.test(String(identifier).trim());
  const query = isNumeric
    ? `SELECT * FROM machines WHERE id = $1 OR machine_code = $2 LIMIT 1`
    : `SELECT * FROM machines WHERE machine_code = $1 LIMIT 1`;
  const params = isNumeric ? [Number(identifier), String(identifier).trim()] : [String(identifier).trim()];

  const result = await db.query<MachineRecord>(query, params);
  return result.rows[0] ?? null;
}

/**
 * POST /api/v1/ipc/events
 * Receives PLC events forwarded by the C# IPC service.
 */
router.post('/events', async (req: Request, res: Response) => {
  const machineId = req.body.machineId ?? req.body.machine_id;
  const eventType = req.body.eventType ?? req.body.event_type;
  const rawTimestamp = req.body.timestamp;
  const serialNumber = req.body.serialNumber ?? req.body.serial_number;
  const productId = req.body.productId ?? req.body.product_id;
  const eventData = req.body.data ?? req.body.eventData ?? req.body.event_data ?? null;

  // 1. Validate machine ID
  if (!machineId) {
    res.status(400).json({ error: "machineId is required (e.g. 'LINE-01')" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const machine = await findMachine(client, machineId);
    if (!machine) {
      await client.query('ROLLBACK');
      res.status(404).json({
        error: `Machine '${machineId}' not found. Please verify machineId.`,
      });
      return;
    }

    // 2. Validate event type
    if (!eventType || !VALID_EVENT_TYPES.includes(eventType as MachineEventType)) {
      await client.query('ROLLBACK');
      res.status(400).json({
        error: `Invalid eventType '${eventType}'.`,
        validEventTypes: VALID_EVENT_TYPES,
      });
      return;
    }

    // 3. Validate timestamp if provided
    let eventTimestamp = new Date();
    if (rawTimestamp) {
      const parsedDate = new Date(rawTimestamp);
      if (isNaN(parsedDate.getTime())) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'Invalid timestamp format. Expected ISO 8601 string.' });
        return;
      }
      eventTimestamp = parsedDate;
    }

    // 4. Resolve product association
    let matchedProductId: number | null = null;
    let matchedSerialNumber: string | null = null;

    if (serialNumber) {
      const prodRes = await client.query<Product>(
        `SELECT * FROM products WHERE serial_number = $1`,
        [serialNumber]
      );
      if (prodRes.rowCount === 0) {
        await client.query('ROLLBACK');
        res.status(404).json({ error: `Product with serialNumber '${serialNumber}' not found` });
        return;
      }
      matchedProductId = prodRes.rows[0].id;
      matchedSerialNumber = prodRes.rows[0].serial_number;
    } else if (productId) {
      const prodRes = await client.query<Product>(
        `SELECT * FROM products WHERE id = $1`,
        [productId]
      );
      if (prodRes.rowCount === 0) {
        await client.query('ROLLBACK');
        res.status(404).json({ error: `Product with id ${productId} not found` });
        return;
      }
      matchedProductId = prodRes.rows[0].id;
      matchedSerialNumber = prodRes.rows[0].serial_number;
    } else if (eventType === 'PRODUCT_DETECTED') {
      // PRODUCT_DETECTED automatically creates or reserves a new product for current RUNNING order
      const runningOrder = await client.query<ProductionOrder>(
        `SELECT * FROM production_orders WHERE status = 'RUNNING' LIMIT 1`
      );
      if (runningOrder.rowCount === 0) {
        await client.query('ROLLBACK');
        res.status(409).json({
          error: "Cannot process 'PRODUCT_DETECTED': No production order is currently RUNNING.",
        });
        return;
      }

      const generated = await generateSerialNumber(client);
      const newProd = await client.query<Product>(
        `INSERT INTO products (serial_number, production_order_id, machine_id, status)
         VALUES ($1, $2, $3, 'IN_PROGRESS')
         RETURNING *`,
        [generated.serialNumber, runningOrder.rows[0].id, machine.id]
      );

      matchedProductId = newProd.rows[0].id;
      matchedSerialNumber = newProd.rows[0].serial_number;
    }

    // 5. Store machine event in PostgreSQL
    const eventResult = await client.query(
      `INSERT INTO machine_events (machine_id, product_id, event_type, event_data, timestamp)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [machine.id, matchedProductId, eventType, eventData ? JSON.stringify(eventData) : null, eventTimestamp]
    );

    // 6. Update machine status & heartbeat if applicable
    let newMachineStatus: MachineStatus | null = null;
    if (eventType === 'MACHINE_STARTED') newMachineStatus = 'RUNNING';
    if (eventType === 'MACHINE_STOPPED') newMachineStatus = 'STOPPED';
    if (eventType === 'MACHINE_ERROR' || eventType === 'EMERGENCY_STOP') newMachineStatus = 'ERROR';

    await client.query(
      `UPDATE machines
       SET status = COALESCE($1, status),
           last_seen_at = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [newMachineStatus, eventTimestamp, machine.id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      data: {
        eventId: eventResult.rows[0].id,
        machineId: machine.machine_code,
        eventType: eventResult.rows[0].event_type,
        productId: matchedProductId,
        serialNumber: matchedSerialNumber,
        timestamp: eventResult.rows[0].timestamp,
        eventData: eventResult.rows[0].event_data,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ipc] POST /events error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/v1/ipc/next-product
 * Retrieves next product information to be marked/inspected.
 * If an active uninspected product exists, returns it; otherwise generates the next product.
 */
router.get('/next-product', async (req: Request, res: Response) => {
  const machineId = (req.query.machineId ?? req.query.machine_id) as string | undefined;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verify active RUNNING order exists
    const orderRes = await client.query<ProductionOrder>(
      `SELECT * FROM production_orders WHERE status = 'RUNNING' LIMIT 1 FOR UPDATE`
    );
    if (orderRes.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'No active production order is currently RUNNING' });
      return;
    }
    const order = orderRes.rows[0];

    // Optional machine resolution
    let machineDbId: number | null = null;
    if (machineId) {
      const machine = await findMachine(client, machineId);
      if (machine) machineDbId = machine.id;
    }

    // 2. Check for latest IN_PROGRESS product with no inspections yet
    const pendingProd = await client.query<Product>(
      `SELECT p.*
       FROM products p
       LEFT JOIN inspections i ON i.product_id = p.id
       WHERE p.production_order_id = $1
         AND p.status = 'IN_PROGRESS'
         AND i.id IS NULL
       ORDER BY p.id ASC
       LIMIT 1`,
      [order.id]
    );

    let product: Product;

    if (pendingProd.rowCount && pendingProd.rowCount > 0) {
      product = pendingProd.rows[0];
    } else {
      // Generate new product atomically
      const { serialNumber } = await generateSerialNumber(client);
      const newProdRes = await client.query<Product>(
        `INSERT INTO products (serial_number, production_order_id, machine_id, status)
         VALUES ($1, $2, $3, 'IN_PROGRESS')
         RETURNING *`,
        [serialNumber, order.id, machineDbId]
      );
      product = newProdRes.rows[0];
    }

    await client.query('COMMIT');

    // Returns format specified in PRD section 5.4
    res.json({
      productionOrderId: order.order_number,
      productCode: order.product_code,
      productName: order.product_name,
      serialNumber: product.serial_number,
      productId: product.id,
      orderId: order.id,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ipc] GET /next-product error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/v1/ipc/inspection-result
 * Receives inspection results (QR_READ / VISION) from Keyence equipment via IPC.
 */
router.post('/inspection-result', async (req: Request, res: Response) => {
  const serialNumber = req.body.serialNumber ?? req.body.serial_number;
  const productId = req.body.productId ?? req.body.product_id;
  const machineId = req.body.machineId ?? req.body.machine_id;
  const inspectionType = req.body.inspectionType ?? req.body.inspection_type;
  const result = req.body.result;
  const details = req.body.details ?? null;
  const rawTimestamp = req.body.timestamp;

  // 1. Validate target product identifier
  if (!serialNumber && !productId) {
    res.status(400).json({ error: "Either 'serialNumber' or 'productId' is required" });
    return;
  }

  // 2. Validate inspectionType
  if (!inspectionType || !VALID_INSPECTION_TYPES.includes(inspectionType as InspectionType)) {
    res.status(400).json({
      error: `Invalid inspectionType '${inspectionType}'. Allowed values: QR_READ, VISION`,
    });
    return;
  }

  // 3. Validate result
  if (!result || !VALID_INSPECTION_RESULTS.includes(result as InspectionResult)) {
    res.status(400).json({
      error: `Invalid result '${result}'. Allowed values: PASS, FAIL`,
    });
    return;
  }

  // 4. Validate timestamp
  let inspectionTimestamp = new Date();
  if (rawTimestamp) {
    const parsed = new Date(rawTimestamp);
    if (isNaN(parsed.getTime())) {
      res.status(400).json({ error: 'Invalid timestamp format. Expected ISO 8601 string.' });
      return;
    }
    inspectionTimestamp = parsed;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 5. Look up product
    const prodQuery = serialNumber
      ? `SELECT p.*, po.order_number FROM products p JOIN production_orders po ON po.id = p.production_order_id WHERE p.serial_number = $1 FOR UPDATE`
      : `SELECT p.*, po.order_number FROM products p JOIN production_orders po ON po.id = p.production_order_id WHERE p.id = $1 FOR UPDATE`;
    const prodParam = serialNumber ? [serialNumber] : [productId];

    const prodRes = await client.query<Product & { order_number: string }>(prodQuery, prodParam);
    if (prodRes.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({
        error: `Product '${serialNumber || productId}' not found`,
      });
      return;
    }
    const product = prodRes.rows[0];

    // Optional machine resolution
    let machineDbId = product.machine_id;
    if (machineId) {
      const machine = await findMachine(client, machineId);
      if (machine) machineDbId = machine.id;
    }

    // 6. Record inspection in inspections table
    const inspectionInsert = await client.query(
      `INSERT INTO inspections (product_id, inspection_type, result, details, timestamp)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [product.id, inspectionType, result, details ? JSON.stringify(details) : null, inspectionTimestamp]
    );

    // 7. Record machine event
    let eventType: MachineEventType;
    if (inspectionType === 'QR_READ') {
      eventType = result === 'PASS' ? 'QR_READ' : 'QR_READ_FAILED';
    } else {
      eventType = result === 'PASS' ? 'VISION_PASS' : 'VISION_FAIL';
    }

    await client.query(
      `INSERT INTO machine_events (machine_id, product_id, event_type, event_data, timestamp)
       VALUES ($1, $2, $3, $4, $5)`,
      [machineDbId, product.id, eventType, details ? JSON.stringify(details) : null, inspectionTimestamp]
    );

    // 8. Update product status
    let updatedStatus = product.status;
    if (result === 'FAIL') {
      updatedStatus = 'FAIL';
      await client.query(
        `UPDATE products SET status = 'FAIL', completed_at = NOW() WHERE id = $1`,
        [product.id]
      );
      // Record product completed event
      await client.query(
        `INSERT INTO machine_events (machine_id, product_id, event_type, event_data, timestamp)
         VALUES ($1, $2, 'PRODUCT_COMPLETED', $3, NOW())`,
        [machineDbId, product.id, JSON.stringify({ finalStatus: 'FAIL', reason: `${inspectionType} FAILED` })]
      );
    } else {
      // Check if both QR_READ and VISION are recorded and PASS
      const allInspections = await client.query<{ inspection_type: string; result: string }>(
        `SELECT inspection_type, result FROM inspections WHERE product_id = $1`,
        [product.id]
      );

      const hasFail = allInspections.rows.some((i) => i.result === 'FAIL');
      const hasQrPass = allInspections.rows.some((i) => i.inspection_type === 'QR_READ' && i.result === 'PASS');
      const hasVisionPass = allInspections.rows.some((i) => i.inspection_type === 'VISION' && i.result === 'PASS');

      if (!hasFail && hasQrPass && hasVisionPass) {
        updatedStatus = 'PASS';
        await client.query(
          `UPDATE products SET status = 'PASS', completed_at = NOW() WHERE id = $1`,
          [product.id]
        );
        // Record product completed PASS event
        await client.query(
          `INSERT INTO machine_events (machine_id, product_id, event_type, event_data, timestamp)
           VALUES ($1, $2, 'PRODUCT_COMPLETED', $3, NOW())`,
          [machineDbId, product.id, JSON.stringify({ finalStatus: 'PASS' })]
        );
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      data: {
        inspectionId: inspectionInsert.rows[0].id,
        productId: product.id,
        serialNumber: product.serial_number,
        orderNumber: product.order_number,
        inspectionType: inspectionInsert.rows[0].inspection_type,
        result: inspectionInsert.rows[0].result,
        productStatus: updatedStatus,
        timestamp: inspectionInsert.rows[0].timestamp,
        details: inspectionInsert.rows[0].details,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ipc] POST /inspection-result error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/v1/ipc/status
 * Updates machine status, heartbeat, and diagnostics reported by the C# IPC service.
 */
router.post('/status', async (req: Request, res: Response) => {
  const machineId = req.body.machineId ?? req.body.machine_id;
  const status = req.body.status;
  const details = req.body.details ?? null;
  const rawTimestamp = req.body.timestamp;

  if (!machineId) {
    res.status(400).json({ error: "machineId is required (e.g. 'LINE-01')" });
    return;
  }

  if (!status || !VALID_MACHINE_STATUSES.includes(status as MachineStatus)) {
    res.status(400).json({
      error: `Invalid status '${status}'.`,
      validStatuses: VALID_MACHINE_STATUSES,
    });
    return;
  }

  let statusTimestamp = new Date();
  if (rawTimestamp) {
    const parsed = new Date(rawTimestamp);
    if (isNaN(parsed.getTime())) {
      res.status(400).json({ error: 'Invalid timestamp format. Expected ISO 8601 string.' });
      return;
    }
    statusTimestamp = parsed;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const machine = await findMachine(client, machineId);
    if (!machine) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: `Machine '${machineId}' not found` });
      return;
    }

    // Update machine status and last_seen_at
    const updated = await client.query<MachineRecord>(
      `UPDATE machines
       SET status = $1, last_seen_at = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, statusTimestamp, machine.id]
    );

    // If status changed or error reported, log corresponding machine event
    let eventType: MachineEventType | null = null;
    if (status !== machine.status) {
      if (status === 'RUNNING') eventType = 'MACHINE_STARTED';
      else if (status === 'STOPPED') eventType = 'MACHINE_STOPPED';
      else if (status === 'ERROR') eventType = 'MACHINE_ERROR';
    }

    if (eventType) {
      await client.query(
        `INSERT INTO machine_events (machine_id, event_type, event_data, timestamp)
         VALUES ($1, $2, $3, $4)`,
        [machine.id, eventType, details ? JSON.stringify(details) : null, statusTimestamp]
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      data: {
        machineId: updated.rows[0].machine_code,
        name: updated.rows[0].name,
        status: updated.rows[0].status,
        lastSeenAt: updated.rows[0].last_seen_at,
        details: details ?? undefined,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ipc] POST /status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/v1/ipc/events
 * Retrieves recent machine events for dashboard display.
 */
router.get('/events', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
    const result = await pool.query(
      `SELECT me.id, me.event_type, me.event_data, me.timestamp,
              m.machine_code, m.name AS machine_name,
              p.serial_number, p.status AS product_status
       FROM machine_events me
       LEFT JOIN machines m ON m.id = me.machine_id
       LEFT JOIN products p ON p.id = me.product_id
       ORDER BY me.timestamp DESC, me.id DESC
       LIMIT $1`,
      [limit]
    );
    res.json({ success: true, data: result.rows, total: result.rowCount });
  } catch (err) {
    console.error('[ipc] GET /events error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/ipc/status
 * Retrieves current status and heartbeat of machines.
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const machineId = (req.query.machineId ?? req.query.machine_id) as string | undefined;
    let query = `SELECT id, machine_code, name, status, last_seen_at, updated_at FROM machines`;
    const params: unknown[] = [];
    if (machineId) {
      query += ` WHERE machine_code = $1 OR id::text = $1 LIMIT 1`;
      params.push(machineId);
    } else {
      query += ` ORDER BY id ASC`;
    }
    const result = await pool.query(query, params);
    res.json({ success: true, data: machineId ? result.rows[0] ?? null : result.rows });
  } catch (err) {
    console.error('[ipc] GET /status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
