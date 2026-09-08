-- Migration: Simplify machine_results table schema
-- Removes product_id, machines foreign key, and converts machine_id to standalone VARCHAR(50)

-- 1. Drop existing foreign keys and columns if present
ALTER TABLE machine_results DROP CONSTRAINT IF EXISTS machine_results_product_id_fkey;
ALTER TABLE machine_results DROP CONSTRAINT IF EXISTS machine_results_machine_id_fkey;
DROP INDEX IF EXISTS idx_machine_results_product_id;

-- 2. Modify machine_id to VARCHAR(50)
ALTER TABLE machine_results ALTER COLUMN machine_id TYPE VARCHAR(50) USING COALESCE(machine_id::text, 'MACHINE-01');
ALTER TABLE machine_results ALTER COLUMN machine_id SET NOT NULL;

-- 3. Drop product_id column
ALTER TABLE machine_results DROP COLUMN IF EXISTS product_id;

-- 4. Recreate clean indexes
DROP INDEX IF EXISTS idx_machine_results_machine_id;
CREATE INDEX IF NOT EXISTS idx_machine_results_machine_id ON machine_results(machine_id);

DROP INDEX IF EXISTS idx_machine_results_status;
CREATE INDEX IF NOT EXISTS idx_machine_results_status ON machine_results(status);

DROP INDEX IF EXISTS idx_machine_results_timestamp;
CREATE INDEX IF NOT EXISTS idx_machine_results_timestamp ON machine_results(timestamp DESC);
