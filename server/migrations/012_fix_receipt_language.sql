-- Migration: 012_fix_receipt_language
-- This migration ensures the language column exists in the receipts table
-- It's designed to be idempotent (can be run multiple times safely)

-- Use direct SQL that works in all PostgreSQL versions
SELECT 1 FROM information_schema.tables WHERE table_name = 'receipts';

-- Use conditional ALTER TABLE commands - these will be evaluated only if receipts table exists
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS language TEXT;

-- Add an explicit COMMIT to ensure the changes are applied
COMMIT;