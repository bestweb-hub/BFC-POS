-- Migration: Add positions and departments tables for HRM
-- Used as lookup for staff position/department dropdowns

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "positions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL UNIQUE,
  "description" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "departments" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL UNIQUE,
  "description" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "positions_name_idx" ON "positions"("name");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "departments_name_idx" ON "departments"("name");
