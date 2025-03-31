-- Migration: 012_fix_receipt_language
-- This migration ensures the language column exists in the receipts table
-- It's designed to be idempotent (can be run multiple times safely)

DO $$
BEGIN
    -- First, check if the receipts table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'receipts') THEN
        RAISE NOTICE 'Receipts table does not exist yet, skipping language column addition';
        RETURN;
    END IF;

    -- Check if the language column already exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'receipts' AND column_name = 'language') THEN
        -- Add the language column
        ALTER TABLE receipts ADD COLUMN language TEXT;
        RAISE NOTICE 'Added language column to receipts table';
    ELSE
        RAISE NOTICE 'Language column already exists in receipts table';
    END IF;

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error during receipt language column addition: %', SQLERRM;
END $$;