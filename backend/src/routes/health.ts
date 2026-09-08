import { Router, Request, Response } from 'express';
import { testConnection } from '../config/database';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    await testConnection();
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      message: err instanceof Error ? err.message : 'Database connection error',
    });
  }
});

export default router;
