-- Up Migration

-- daily_sequences: atomic per-day counter for serial number generation.
-- Using INSERT ... ON CONFLICT DO UPDATE makes increment + read a single atomic operation.
CREATE TABLE IF NOT EXISTS daily_sequences (
    seq_date DATE    NOT NULL,
    prefix   VARCHAR(20) NOT NULL DEFAULT 'QR',
    last_seq INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (seq_date, prefix)
);

-- Down Migration

DROP TABLE IF EXISTS daily_sequences;
