-- ==========================
-- RECEIPTS TABLE
-- ==========================
CREATE TABLE IF NOT EXISTS receipts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    store_id INTEGER REFERENCES stores(id),
    language TEXT,
    image_url TEXT,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    upload_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    extracted_data JSONB,
    total_amount DECIMAL(10, 2),
    receipt_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    receipt_number TEXT,
    payment_method TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indices for the new table
CREATE INDEX "receipts_userId_idx" ON "receipts"("user_id");
CREATE INDEX "receipts_storeId_idx" ON "receipts"("store_id");
CREATE INDEX "receipts_uploadDate_idx" ON "receipts"("upload_date");
CREATE INDEX "receipts_receiptDate_idx" ON "receipts"("receipt_date");