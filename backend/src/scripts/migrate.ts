import dotenv from 'dotenv';
dotenv.config();

import { runMigrations } from '../config/migrator';

const direction = process.argv[2] === 'down' ? 'down' : 'up';

runMigrations(direction)
  .then(() => {
    console.log(`[Migrations] Migration command completed successfully (${direction}).`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Migrations] Migration failed:', err);
    process.exit(1);
  });
