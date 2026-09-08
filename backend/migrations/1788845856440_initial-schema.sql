-- Up Migration

-- 1. machines
CREATE TABLE IF NOT EXISTS machines (
    id           SERIAL PRIMARY KEY,
    machine_code VARCHAR(50)  NOT NULL UNIQUE,
    name         VARCHAR(100) NOT NULL,
    status       VARCHAR(20)  NOT NULL DEFAULT 'UNKNOWN',
    last_seen_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT machines_status_check CHECK (
        status IN ('RUNNING', 'STOPPED', 'ERROR', 'UNKNOWN')
    )
);

-- 2. production_orders
CREATE TABLE IF NOT EXISTS production_orders (
    id              SERIAL PRIMARY KEY,
    order_number    VARCHAR(50)  NOT NULL UNIQUE,
    product_code    VARCHAR(50)  NOT NULL,
    product_name    VARCHAR(100) NOT NULL,
    target_quantity INTEGER      NOT NULL CHECK (target_quantity > 0),
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT production_orders_status_check CHECK (
        status IN ('PENDING', 'RUNNING', 'COMPLETED', 'CANCELLED')
    )
);

-- 3. products
-- Products must belong to a production order
CREATE TABLE IF NOT EXISTS products (
    id                  SERIAL PRIMARY KEY,
    serial_number       VARCHAR(50)  NOT NULL UNIQUE,
    production_order_id INTEGER      NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
    machine_id          INTEGER      REFERENCES machines(id) ON DELETE SET NULL,
    status              VARCHAR(20)  NOT NULL DEFAULT 'IN_PROGRESS',
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,

    CONSTRAINT products_status_check CHECK (
        status IN ('IN_PROGRESS', 'PASS', 'FAIL', 'UNKNOWN')
    )
);

-- 4. machine_events
-- Machine events may reference a product and machine
CREATE TABLE IF NOT EXISTS machine_events (
    id         SERIAL PRIMARY KEY,
    machine_id INTEGER REFERENCES machines(id) ON DELETE SET NULL,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    event_type VARCHAR(50)  NOT NULL,
    event_data JSONB,
    timestamp  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT machine_events_type_check CHECK (
        event_type IN (
            'PRODUCT_DETECTED',
            'PRINT_STARTED',
            'PRINT_COMPLETED',
            'PRINT_FAILED',
            'QR_READ',
            'QR_READ_FAILED',
            'VISION_PASS',
            'VISION_FAIL',
            'PRODUCT_COMPLETED',
            'MACHINE_STARTED',
            'MACHINE_STOPPED',
            'MACHINE_ERROR',
            'EMERGENCY_STOP'
        )
    )
);

-- 5. inspections
-- Inspections must reference a product
CREATE TABLE IF NOT EXISTS inspections (
    id              SERIAL PRIMARY KEY,
    product_id      INTEGER      NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    inspection_type VARCHAR(50)  NOT NULL,
    result          VARCHAR(10)  NOT NULL,
    details         JSONB,
    timestamp       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT inspections_type_check CHECK (
        inspection_type IN ('QR_READ', 'VISION')
    ),
    CONSTRAINT inspections_result_check CHECK (
        result IN ('PASS', 'FAIL')
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_production_orders_status       ON production_orders(status);
CREATE INDEX IF NOT EXISTS idx_products_serial_number         ON products(serial_number);
CREATE INDEX IF NOT EXISTS idx_products_production_order_id   ON products(production_order_id);
CREATE INDEX IF NOT EXISTS idx_products_machine_id            ON products(machine_id);
CREATE INDEX IF NOT EXISTS idx_products_status                ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_created_at            ON products(created_at);
CREATE INDEX IF NOT EXISTS idx_machine_events_machine_id      ON machine_events(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_events_product_id      ON machine_events(product_id);
CREATE INDEX IF NOT EXISTS idx_machine_events_event_type      ON machine_events(event_type);
CREATE INDEX IF NOT EXISTS idx_machine_events_timestamp       ON machine_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_inspections_product_id         ON inspections(product_id);
CREATE INDEX IF NOT EXISTS idx_inspections_type               ON inspections(inspection_type);
CREATE INDEX IF NOT EXISTS idx_inspections_result             ON inspections(result);
CREATE INDEX IF NOT EXISTS idx_inspections_timestamp          ON inspections(timestamp DESC);

-- Down Migration

DROP TABLE IF EXISTS inspections CASCADE;
DROP TABLE IF EXISTS machine_events CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS production_orders CASCADE;
DROP TABLE IF EXISTS machines CASCADE;