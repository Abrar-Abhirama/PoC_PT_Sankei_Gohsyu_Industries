// eslint-disable-next-line @typescript-eslint/no-var-requires
const { runner } = require('node-pg-migrate');
import path from 'path';

export function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const user = process.env.POSTGRES_USER || 'sankei_user';
  const password = process.env.POSTGRES_PASSWORD || 'sankei_password';
  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.POSTGRES_PORT || '5432';
  const db = process.env.POSTGRES_DB || 'sankei_db';
  return `postgres://${user}:${password}@${host}:${port}/${db}`;
}

export async function runMigrations(direction: 'up' | 'down' = 'up'): Promise<void> {
  const databaseUrl = getDatabaseUrl();
  const migrationsDir = path.resolve(__dirname, '../../migrations');

  console.log(`[Migrations] Running database migrations (${direction})...`);
  const result = await runner({
    databaseUrl,
    dir: migrationsDir,
    direction,
    migrationsTable: 'pgmigrations',
    verbose: true,
  });

  console.log(`[Migrations] Applied ${result.length} migration(s).`);
}
