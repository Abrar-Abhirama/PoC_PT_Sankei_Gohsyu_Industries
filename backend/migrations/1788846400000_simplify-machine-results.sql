-- Up Migration

-- Allow OK and NG statuses on products
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE products ADD CONSTRAINT products_status_check 
    CHECK (status IN ('IN_PROGRESS', 'OK', 'NG', 'PASS', 'FAIL', 'UNKNOWN'));

-- machine_results: Simplified machine result table (OK / NG) reported by OPC UA Client
CREATE TABLE IF NOT EXISTS machine_results (
    id           SERIAL PRIMARY KEY,
    machine_id   INTEGER REFERENCES machines(id) ON DELETE SET NULL,
    product_id   INTEGER REFERENCES products(id) ON DELETE SET NULL,
    status       VARCHAR(10) NOT NULL CHECK (status IN ('OK', 'NG')),
    timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_machine_results_machine_id ON machine_results(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_results_product_id ON machine_results(product_id);
CREATE INDEX IF NOT EXISTS idx_machine_results_status     ON machine_results(status);
CREATE INDEX IF NOT EXISTS idx_machine_results_timestamp  ON machine_results(timestamp DESC);

-- Down Migration

DROP TABLE IF EXISTS machine_results CASCADE;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE products ADD CONSTRAINT products_status_check 
    CHECK (status IN ('IN_PROGRESS', 'PASS', 'FAIL', 'UNKNOWN'));
