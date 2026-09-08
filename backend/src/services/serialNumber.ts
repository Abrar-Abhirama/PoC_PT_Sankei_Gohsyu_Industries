import { PoolClient } from 'pg';
import pool from '../config/database';

export interface GeneratedSerial {
  serialNumber: string;
  date: string;
  seq: number;
}

/**
 * Generates the next unique serial number for the given date.
 *
 * Uses a single atomic INSERT ... ON CONFLICT DO UPDATE ... RETURNING
 * so that concurrent requests never produce the same sequence number.
 *
 * Format: QR-YYYYMMDD-000001
 */
export async function generateSerialNumber(
  client?: PoolClient
): Promise<GeneratedSerial> {
  const db = client ?? pool;

  // One atomic statement: insert or increment, return the resulting seq
  const result = await db.query<{ seq_date: Date; last_seq: number }>(
    `INSERT INTO daily_sequences (seq_date, prefix, last_seq)
     VALUES (CURRENT_DATE, 'QR', 1)
     ON CONFLICT (seq_date, prefix) DO UPDATE
       SET last_seq = daily_sequences.last_seq + 1
     RETURNING seq_date, last_seq`
  );

  const { seq_date, last_seq } = result.rows[0];

  // seq_date comes back as a JS Date from pg — format as YYYYMMDD
  const iso = seq_date instanceof Date
    ? seq_date.toISOString().slice(0, 10)
    : String(seq_date);
  const datePart = iso.replace(/-/g, '');

  // Zero-pad sequence to 6 digits
  const seqPart = String(last_seq).padStart(6, '0');

  const serialNumber = `QR-${datePart}-${seqPart}`;

  return { serialNumber, date: iso, seq: last_seq };
}
