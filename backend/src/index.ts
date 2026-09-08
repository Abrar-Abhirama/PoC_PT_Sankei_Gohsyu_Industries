import app from './app';
import { testConnection } from './config/database';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function main(): Promise<void> {
  // Verify database connection on startup
  console.log('[Startup] Connecting to PostgreSQL...');
  try {
    await testConnection();
    console.log('[Startup] ✓ PostgreSQL connected successfully');
  } catch (err) {
    console.error('[Startup] ✗ Failed to connect to PostgreSQL:', err);
    // Exit so Docker Compose can restart and retry
    process.exit(1);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Startup] ✓ Server running on http://0.0.0.0:${PORT}`);
    console.log(`[Startup]   Health: http://0.0.0.0:${PORT}/health`);
    console.log(`[Startup]   API:    http://0.0.0.0:${PORT}/api/v1`);
  });
}

main();
