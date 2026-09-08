import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'sankei_db',
  user: process.env.POSTGRES_USER || 'sankei_user',
  password: process.env.POSTGRES_PASSWORD || 'sankei_password',
  // Connection pool settings
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

/**
 * Test the database connection.
 * Throws if the connection cannot be established.
 */
export async function testConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}

export default pool;
