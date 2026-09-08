import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { generateSerialNumber } from '../services/serialNumber';
import type { Product } from '../types/product';
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

    // Generate serial number atomically (inside transaction for consistency)
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

// GET /api/v1/products/:serialNumber
// Retrieve a product by its serial number.
router.get('/:serialNumber', async (req: Request, res: Response) => {
  const { serialNumber } = req.params;

  try {
    const result = await pool.query<Product & { order_number: string; product_name: string }>(
      `SELECT p.*, po.order_number, po.product_name
       FROM products p
       JOIN production_orders po ON po.id = p.production_order_id
       WHERE p.serial_number = $1`,
      [serialNumber]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: `Product with serial number '${serialNumber}' not found` });
      return;
    }

    res.json({ data: result.rows[0] });
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
