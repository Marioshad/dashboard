-- Migration to add receipts table for storing uploaded receipt paths

-- Check if receipts table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'receipts') THEN
    -- Create receipts table if it doesn't exist
    CREATE TABLE "receipts" (
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
    
    -- Create indices for the new table
    CREATE INDEX "receipts_userId_idx" ON "receipts"("userId");
    CREATE INDEX "receipts_storeId_idx" ON "receipts"("storeId");
    CREATE INDEX "receipts_uploadDate_idx" ON "receipts"("uploadDate");
    CREATE INDEX "receipts_receiptDate_idx" ON "receipts"("receiptDate");
  END IF;
END $$;

-- Add receipts relation to food_items table if the column doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'food_items' AND column_name = 'receiptId') THEN
    ALTER TABLE "food_items" ADD COLUMN "receiptId" INTEGER REFERENCES "receipts"("id");
    CREATE INDEX "food_items_receiptId_idx" ON "food_items"("receiptId");
  END IF;
END $$;