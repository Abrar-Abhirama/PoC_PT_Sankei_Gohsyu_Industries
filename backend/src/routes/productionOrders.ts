import { Router, Request, Response } from 'express';
import pool from '../config/database';
import type { CreateProductionOrderBody, ProductionOrder } from '../types/productionOrder';

const router = Router();

// GET /api/v1/production-orders
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query<ProductionOrder>(
      `SELECT * FROM production_orders ORDER BY created_at DESC`
    );
    res.json({ data: result.rows, total: result.rowCount });
  } catch (err) {
    console.error('[production-orders] GET / error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/production-orders
router.post('/', async (req: Request, res: Response) => {
  const { order_number, product_code, product_name, target_quantity } =
    req.body as CreateProductionOrderBody;

  if (!order_number || typeof order_number !== 'string' || order_number.trim() === '') {
    res.status(400).json({ error: 'order_number is required and must be a non-empty string' });
    return;
  }
  if (!product_code || typeof product_code !== 'string' || product_code.trim() === '') {
    res.status(400).json({ error: 'product_code is required and must be a non-empty string' });
    return;
  }
  if (!product_name || typeof product_name !== 'string' || product_name.trim() === '') {
    res.status(400).json({ error: 'product_name is required and must be a non-empty string' });
    return;
  }
  if (
    target_quantity === undefined ||
    target_quantity === null ||
    !Number.isInteger(target_quantity) ||
    target_quantity <= 0
  ) {
    res.status(400).json({ error: 'target_quantity is required and must be a positive integer' });
    return;
  }

  try {
    const result = await pool.query<ProductionOrder>(
      `INSERT INTO production_orders (order_number, product_code, product_name, target_quantity, status)
       VALUES ($1, $2, $3, $4, 'PENDING')
       RETURNING *`,
      [order_number.trim(), product_code.trim(), product_name.trim(), target_quantity]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      res.status(409).json({ error: `order_number '${order_number}' already exists` });
      return;
    }
    console.error('[production-orders] POST / error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/production-orders/:id
router.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'id must be a valid integer' });
    return;
  }

  try {
    const result = await pool.query<ProductionOrder>(
      `SELECT * FROM production_orders WHERE id = $1`,
      [id]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: `Production order ${id} not found` });
      return;
    }
    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('[production-orders] GET /:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
