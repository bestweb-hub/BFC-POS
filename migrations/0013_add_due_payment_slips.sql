-- Add payment_slips column to due_payments for slip image URLs (JSON array)
ALTER TABLE "due_payments" ADD COLUMN IF NOT EXISTS "payment_slips" text;
