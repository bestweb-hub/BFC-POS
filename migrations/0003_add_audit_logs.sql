-- Migration: Add audit_logs table for activity tracking
-- Creates audit_logs table to track all user actions and system events

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar,
  "username" text,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" varchar,
  "entity_name" text,
  "description" text,
  "changes" text,
  "ip_address" text,
  "user_agent" text,
  "branch_id" varchar,
  "created_at" timestamp NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs"("user_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_entity_type_idx" ON "audit_logs"("entity_type");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");

