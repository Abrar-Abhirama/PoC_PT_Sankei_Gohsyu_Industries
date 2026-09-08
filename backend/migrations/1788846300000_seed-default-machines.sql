-- Up Migration

-- Seed default machines for IPC integration
INSERT INTO machines (machine_code, name, status)
VALUES 
    ('LINE-01', 'Production Line 01 - Main Line', 'STOPPED'),
    ('LINE-02', 'Production Line 02 - Secondary Line', 'STOPPED')
ON CONFLICT (machine_code) DO NOTHING;

-- Down Migration

DELETE FROM machines WHERE machine_code IN ('LINE-01', 'LINE-02');
