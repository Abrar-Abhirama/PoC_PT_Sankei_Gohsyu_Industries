-- =============================================================
-- PoC Machine OK/NG Traceability System — Database Schema
-- PT Sankei Gohsyu Industries
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- machine_results
-- Production inspection results reported by OPC UA Client (OK / NG)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS machine_results (
    id           SERIAL PRIMARY KEY,
    machine_id   VARCHAR(50) NOT NULL,
    status       VARCHAR(10) NOT NULL CHECK (status IN ('OK', 'NG')),
    timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_machine_results_machine_id ON machine_results(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_results_status     ON machine_results(status);
CREATE INDEX IF NOT EXISTS idx_machine_results_timestamp  ON machine_results(timestamp DESC);
