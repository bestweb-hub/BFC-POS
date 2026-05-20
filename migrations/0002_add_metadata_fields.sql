-- Migration: Add website metadata fields to settings table
-- Adds websiteTitle, websiteDescription, favicon, appName, and appTagline columns

--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "website_title" text;

--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "website_description" text;

--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "favicon" text;

--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "app_name" text;

--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "app_tagline" text;

