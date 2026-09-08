import app from './app';
import { testConnection } from './config/database';
import { runMigrations } from './config/migrator';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function main(): Promise<void> {
  console.log('[Startup] Connecting to PostgreSQL...');
  try {
    await testConnection();
    console.log('[Startup] ✓ PostgreSQL connected successfully');

    await runMigrations('up');
    console.log('[Startup] ✓ Database migrations up to date');
  } catch (err) {
    console.error('[Startup] ✗ Database initialization failed:', err);
    process.exit(1);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Startup] ✓ Server running on http://0.0.0.0:${PORT}`);
    console.log(`[Startup]   Health: http://0.0.0.0:${PORT}/api/v1/health`);
    console.log(`[Startup]   API:    http://0.0.0.0:${PORT}/api/v1`);
  });
}

main();
