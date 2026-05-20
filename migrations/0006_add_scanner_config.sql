-- Migration: Add barcode scanner configuration fields
-- Adds scanner type, scan delay, and beep sound settings

--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "barcode_scanner_type" text NOT NULL DEFAULT 'keyboard';

--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "barcode_scan_delay" integer NOT NULL DEFAULT 200;

--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "barcode_beep_sound" text NOT NULL DEFAULT 'true';

