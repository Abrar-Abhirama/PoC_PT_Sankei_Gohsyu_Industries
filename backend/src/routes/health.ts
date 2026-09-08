import { Router, Request, Response } from 'express';
import { testConnection } from '../config/database';

const router = Router();

/**
 * GET /health
 * Returns the API status and database connectivity.
 */
router.get('/', async (_req: Request, res: Response) => {
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'sankei-backend',
    version: '1.0.0',
    database: 'unknown' as 'ok' | 'error' | 'unknown',
    error: undefined as string | undefined,
  };

  try {
    await testConnection();
    status.database = 'ok';
  } catch (err) {
    status.status = 'degraded';
    status.database = 'error';
    status.error = err instanceof Error ? err.message : 'Unknown database error';
  }

  const httpStatus = status.status === 'ok' ? 200 : 503;
  res.status(httpStatus).json(status);
});

export default router;
