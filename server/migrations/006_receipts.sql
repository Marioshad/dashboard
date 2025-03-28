-- Migration to add receipts table for storing uploaded receipt paths

-- Create receipts table
CREATE TABLE IF NOT EXISTS "receipts" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES "users"("id"),
  "storeId" INTEGER REFERENCES "stores"("id"),
  "filePath" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "mimeType" TEXT NOT NULL,
  "uploadDate" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "extractedData" JSONB,
  "totalAmount" DECIMAL(10, 2),
  "receiptDate" TIMESTAMP WITH TIME ZONE,
  "receiptNumber" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for faster lookup by user ID
CREATE INDEX IF NOT EXISTS "receipts_userId_idx" ON "receipts"("userId");

-- Create index for faster lookup by store ID
CREATE INDEX IF NOT EXISTS "receipts_storeId_idx" ON "receipts"("storeId");

-- Create index for faster date-based queries
CREATE INDEX IF NOT EXISTS "receipts_uploadDate_idx" ON "receipts"("uploadDate");
CREATE INDEX IF NOT EXISTS "receipts_receiptDate_idx" ON "receipts"("receiptDate");

-- Add receipts relation to food_items table
ALTER TABLE "food_items" ADD COLUMN IF NOT EXISTS "receiptId" INTEGER REFERENCES "receipts"("id");

-- Add index for the new foreign key
CREATE INDEX IF NOT EXISTS "food_items_receiptId_idx" ON "food_items"("receiptId");