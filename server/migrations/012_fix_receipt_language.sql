-- Migration: 012_fix_receipt_structure
-- This migration ensures all necessary columns exist in the receipts table
-- It's designed to be idempotent (can be run multiple times safely)

-- Check if any tables are missing and create them if needed (simplified versions)
CREATE TABLE IF NOT EXISTS receipts (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "storeId" INTEGER,
  "filePath" TEXT,
  "fileName" TEXT,
  "fileSize" INTEGER,
  "mimeType" TEXT,
  "uploadDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "receiptDate" TIMESTAMP,
  "receiptNumber" TEXT,
  "totalAmount" DECIMAL(10, 2),
  language TEXT,
  "paymentMethod" TEXT,
  "extractedData" JSONB,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add any missing columns one by one
DO $$
BEGIN
    -- Add userId if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'userId') THEN
        ALTER TABLE receipts ADD COLUMN "userId" INTEGER;
    END IF;

    -- Add storeId if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'storeId') THEN
        ALTER TABLE receipts ADD COLUMN "storeId" INTEGER;
    END IF;

    -- Add filePath if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'filePath') THEN
        ALTER TABLE receipts ADD COLUMN "filePath" TEXT;
    END IF;

    -- Add fileName if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'fileName') THEN
        ALTER TABLE receipts ADD COLUMN "fileName" TEXT;
    END IF;

    -- Add fileSize if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'fileSize') THEN
        ALTER TABLE receipts ADD COLUMN "fileSize" INTEGER;
    END IF;

    -- Add mimeType if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'mimeType') THEN
        ALTER TABLE receipts ADD COLUMN "mimeType" TEXT;
    END IF;

    -- Add uploadDate if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'uploadDate') THEN
        ALTER TABLE receipts ADD COLUMN "uploadDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;

    -- Add receiptDate if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'receiptDate') THEN
        ALTER TABLE receipts ADD COLUMN "receiptDate" TIMESTAMP;
    END IF;

    -- Add receiptNumber if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'receiptNumber') THEN
        ALTER TABLE receipts ADD COLUMN "receiptNumber" TEXT;
    END IF;

    -- Add totalAmount if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'totalAmount') THEN
        ALTER TABLE receipts ADD COLUMN "totalAmount" DECIMAL(10, 2);
    END IF;

    -- Add language if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'language') THEN
        ALTER TABLE receipts ADD COLUMN language TEXT;
    END IF;

    -- Add paymentMethod if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'paymentMethod') THEN
        ALTER TABLE receipts ADD COLUMN "paymentMethod" TEXT;
    END IF;

    -- Add extractedData if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'extractedData') THEN
        ALTER TABLE receipts ADD COLUMN "extractedData" JSONB;
    END IF;

    -- Add createdAt if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'createdAt') THEN
        ALTER TABLE receipts ADD COLUMN "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;

    -- Add updatedAt if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'receipts' AND column_name = 'updatedAt') THEN
        ALTER TABLE receipts ADD COLUMN "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;

END $$;

-- Check if food_items table has the receiptId column and add if missing
DO $$
BEGIN
    -- First check if food_items table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'food_items') THEN
        -- Add receiptId if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'food_items' AND column_name = 'receiptId') THEN
            ALTER TABLE food_items ADD COLUMN "receiptId" INTEGER;
        END IF;
    END IF;
END $$;

-- Add an explicit COMMIT to ensure the changes are applied
COMMIT;