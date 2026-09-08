import { Router, Request, Response } from 'express';
import pool from '../config/database';
import type { ProductionOrder } from '../types/productionOrder';

const router = Router();

// POST /api/v1/production/start
// Starts a PENDING production order. Only one order can be RUNNING at a time.
router.post('/start', async (req: Request, res: Response) => {
  const { id } = req.body as { id?: number };

  if (!id || !Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'id is required and must be a positive integer' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if any order is already RUNNING
    const running = await client.query<ProductionOrder>(
      `SELECT id, order_number FROM production_orders WHERE status = 'RUNNING' LIMIT 1`
    );
    if (running.rowCount && running.rowCount > 0) {
      await client.query('ROLLBACK');
      res.status(409).json({
        error: `Another production order is already running (id: ${running.rows[0].id}, order: ${running.rows[0].order_number})`,
      });
      return;
    }

    // Fetch the target order
    const orderResult = await client.query<ProductionOrder>(
      `SELECT * FROM production_orders WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (orderResult.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: `Production order ${id} not found` });
      return;
    }

    const order = orderResult.rows[0];
    if (order.status !== 'PENDING') {
      await client.query('ROLLBACK');
      res.status(409).json({
        error: `Cannot start order with status '${order.status}'. Only PENDING orders can be started`,
      });
      return;
    }

    // Transition to RUNNING
    const updated = await client.query<ProductionOrder>(
      `UPDATE production_orders
       SET status = 'RUNNING', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    await client.query('COMMIT');
    res.json({ data: updated.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[production] POST /start error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /api/v1/production/stop
// Stops the currently RUNNING production order.
router.post('/stop', async (req: Request, res: Response) => {
  const { id, reason } = req.body as { id?: number; reason?: 'COMPLETED' | 'CANCELLED' };

  if (!id || !Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'id is required and must be a positive integer' });
    return;
  }
  if (reason && !['COMPLETED', 'CANCELLED'].includes(reason)) {
    res.status(400).json({ error: "reason must be 'COMPLETED' or 'CANCELLED'" });
    return;
  }

  const finalStatus = reason === 'CANCELLED' ? 'CANCELLED' : 'COMPLETED';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderResult = await client.query<ProductionOrder>(
      `SELECT * FROM production_orders WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (orderResult.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: `Production order ${id} not found` });
      return;
    }

    const order = orderResult.rows[0];
    if (order.status !== 'RUNNING') {
      await client.query('ROLLBACK');
      res.status(409).json({
        error: `Cannot stop order with status '${order.status}'. Only RUNNING orders can be stopped`,
      });
      return;
    }

    const updated = await client.query<ProductionOrder>(
      `UPDATE production_orders
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [finalStatus, id]
    );

    await client.query('COMMIT');
    res.json({ data: updated.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[production] POST /stop error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /api/v1/production/current
// Returns the currently RUNNING production order, if any.
router.get('/current', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query<ProductionOrder>(
      `SELECT po.*,
              COUNT(p.id) AS produced_quantity,
              COUNT(p.id) FILTER (WHERE p.status = 'PASS') AS pass_quantity,
              COUNT(p.id) FILTER (WHERE p.status = 'FAIL') AS fail_quantity
       FROM production_orders po
       LEFT JOIN products p ON p.production_order_id = po.id
       WHERE po.status = 'RUNNING'
       GROUP BY po.id
       LIMIT 1`
    );

    if (result.rowCount === 0) {
      res.json({ data: null });
      return;
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    console.error('[production] GET /current error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
