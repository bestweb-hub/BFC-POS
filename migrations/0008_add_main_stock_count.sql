-- Add main_stock_count column to main_products table
ALTER TABLE "main_products" ADD COLUMN IF NOT EXISTS "main_stock_count" numeric(10, 2) DEFAULT '0';
