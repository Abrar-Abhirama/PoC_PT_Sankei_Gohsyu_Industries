import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import healthRouter from './routes/health';
import productionOrdersRouter from './routes/productionOrders';
import productionRouter from './routes/production';
import productsRouter from './routes/products';
import ipcRouter from './routes/ipc';

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

app.use('/health', healthRouter);
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/production-orders', productionOrdersRouter);
app.use('/api/v1/production', productionRouter);
app.use('/api/v1/products', productsRouter);
app.use('/api/v1/ipc', ipcRouter);

app.get('/api/v1', (_req: Request, res: Response) => {
  res.json({
    message: 'Sankei QR Traceability API',
    version: '1.0.0',
    status: 'running',
    endpoints: [
      'GET  /api/v1/health',
      'GET  /api/v1/production-orders',
      'POST /api/v1/production-orders',
      'GET  /api/v1/production-orders/:id',
      'POST /api/v1/production/start',
      'POST /api/v1/production/stop',
      'GET  /api/v1/production/current',
      'POST /api/v1/products',
      'GET  /api/v1/products',
      'GET  /api/v1/products/:serialNumber',
      'POST /api/v1/ipc/events',
      'GET  /api/v1/ipc/next-product',
      'POST /api/v1/ipc/inspection-result',
      'POST /api/v1/ipc/status',
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
