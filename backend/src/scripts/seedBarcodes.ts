import pool from '../config/database';

async function seedBarcodes(count = 20) {
  console.log(`[Seed] Generating ${count} mock PENDING barcodes...`);
  try {
    const seedQuery = `
      INSERT INTO barcodes (barcode, status)
      SELECT 
        'PART_R_ID' || to_char(NOW(), 'YYYYMMDDHH24MISS') || '_' || lpad(i::text, 4, '0'),
        'PENDING'
      FROM generate_series(1, $1) AS s(i)
      RETURNING id, barcode, status;
    `;

    const result = await pool.query(seedQuery, [count]);
    console.log(`[Seed] ✓ Successfully inserted ${result.rowCount} PENDING barcodes:`);
    result.rows.forEach(r => console.log(`  - ID: ${r.id} | ${r.barcode} [${r.status}]`));
  } catch (err) {
    console.error('[Seed] Error generating barcodes:', err);
  } finally {
    await pool.end();
  }
}

const countArg = parseInt(process.argv[2], 10) || 20;
seedBarcodes(countArg);