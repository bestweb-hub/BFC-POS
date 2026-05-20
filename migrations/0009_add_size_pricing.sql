--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "size_prices" jsonb;

--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "selected_size" varchar(50);
