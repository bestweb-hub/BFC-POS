-- Add size_purchase_prices column for per-size purchase cost when size-based pricing is used
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "size_purchase_prices" jsonb;
