import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import healthRouter from './routes/health';
import machineResultsRouter from './routes/machineResults';

const app: Application = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

// Health check endpoints
app.use('/health', healthRouter);
app.use('/api/v1/health', healthRouter);

// Machine Results endpoints (PoC Scope: OK / NG)
app.use('/api/v1/machine-results', machineResultsRouter);

// Root API listing
app.get('/api/v1', (_req: Request, res: Response) => {
  res.json({
    message: 'Sankei Machine OK/NG Traceability API (PoC Scope)',
    version: '2.0.0',
    status: 'running',
    endpoints: [
      'GET  /api/v1/health',
      'POST /api/v1/machine-results',
      'GET  /api/v1/machine-results',
      'GET  /api/v1/machine-results/latest',
      'GET  /api/v1/machine-results/summary',
    ],
  });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
