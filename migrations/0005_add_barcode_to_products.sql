-- Migration: Add barcode field to products table
-- Adds barcode column for QR code/barcode scanning

--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "barcode" varchar(255);

--> statement-breakpoint
-- Generate barcodes for existing products using their IDs
UPDATE "products" SET "barcode" = "id" WHERE "barcode" IS NULL;

