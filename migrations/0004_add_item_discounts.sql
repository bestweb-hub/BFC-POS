-- Migration: Add item discount fields to order_items table
-- Adds itemDiscount (decimal) and itemDiscountType (varchar) columns

--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "item_discount" numeric(10, 2) DEFAULT '0';

--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "item_discount_type" varchar(20) DEFAULT 'amount';

