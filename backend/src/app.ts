import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import healthRouter from './routes/health';

const app: Application = express();

// ─────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger (development only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

// ─────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────
app.use('/health', healthRouter);

// API v1 placeholder — routes will be added in subsequent phases
app.get('/api/v1', (_req: Request, res: Response) => {
  res.json({
    message: 'Sankei QR Traceability API',
    version: '1.0.0',
    status: 'running',
  });
});

// ─────────────────────────────────────────────────────────────
// 404 Handler
// ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// ─────────────────────────────────────────────────────────────
// Global Error Handler
// ─────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
