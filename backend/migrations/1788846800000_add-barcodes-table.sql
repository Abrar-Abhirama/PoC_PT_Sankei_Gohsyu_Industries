-- Up Migration
CREATE TABLE IF NOT EXISTS barcodes (
    id          SERIAL PRIMARY KEY,
    barcode     VARCHAR(255) NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT barcodes_status_check CHECK (status IN ('PENDING', 'PROCESSING', 'OK', 'NG'))
);

CREATE INDEX IF NOT EXISTS idx_barcodes_status ON barcodes(status);

-- Down Migration
DROP TABLE IF EXISTS barcodes CASCADE;