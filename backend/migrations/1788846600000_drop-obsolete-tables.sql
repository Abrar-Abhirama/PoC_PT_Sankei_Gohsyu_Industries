-- Migration: Drop all obsolete tables from the previous complex architecture
-- Only machine_results and pgmigrations remain.

DROP TABLE IF EXISTS inspections CASCADE;
DROP TABLE IF EXISTS machine_events CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS production_orders CASCADE;
DROP TABLE IF EXISTS machines CASCADE;
DROP TABLE IF EXISTS daily_sequences CASCADE;
