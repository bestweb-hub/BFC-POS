-- Subscription loyalty cards (barcode-linked customer discounts)
CREATE TABLE IF NOT EXISTS "subscription_cards" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "barcode" text NOT NULL UNIQUE,
  "customer_id" varchar NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "discount_override_value" numeric(10, 2),
  "is_active" text NOT NULL DEFAULT 'true',
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "subscription_card_id" varchar;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "subscription_discount" numeric(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "subscription_program_enabled" text NOT NULL DEFAULT 'true';
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "subscription_min_spend" numeric(10, 2) NOT NULL DEFAULT 50;
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "subscription_discount_type" text NOT NULL DEFAULT 'percentage';
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "subscription_discount_value" numeric(10, 2) NOT NULL DEFAULT 5;
