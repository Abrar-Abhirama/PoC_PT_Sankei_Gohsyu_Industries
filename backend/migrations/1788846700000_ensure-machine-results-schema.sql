-- Up Migration
-- Ensure machine_results table has exact required columns, constraints, and indexes

CREATE TABLE IF NOT EXISTS machine_results (
    id           SERIAL PRIMARY KEY,
    machine_id   VARCHAR(50) NOT NULL,
    status       VARCHAR(10) NOT NULL,
    timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure NOT NULL constraints
ALTER TABLE machine_results ALTER COLUMN machine_id SET NOT NULL;
ALTER TABLE machine_results ALTER COLUMN status SET NOT NULL;
ALTER TABLE machine_results ALTER COLUMN timestamp SET NOT NULL;
ALTER TABLE machine_results ALTER COLUMN created_at SET NOT NULL;

-- Ensure CHECK constraint: status must only allow 'OK' or 'NG'
ALTER TABLE machine_results DROP CONSTRAINT IF EXISTS machine_results_status_check;
ALTER TABLE machine_results ADD CONSTRAINT machine_results_status_check
    CHECK (status IN ('OK', 'NG'));

-- Ensure required indexes: machine_id, timestamp, status
CREATE INDEX IF NOT EXISTS idx_machine_results_machine_id ON machine_results(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_results_status     ON machine_results(status);
CREATE INDEX IF NOT EXISTS idx_machine_results_timestamp  ON machine_results(timestamp DESC);

-- Down Migration
DROP INDEX IF EXISTS idx_machine_results_timestamp;
DROP INDEX IF EXISTS idx_machine_results_status;
DROP INDEX IF EXISTS idx_machine_results_machine_id;
ALTER TABLE machine_results DROP CONSTRAINT IF EXISTS machine_results_status_check;
