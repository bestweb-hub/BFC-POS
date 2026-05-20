-- Add detailed salary fields to staff_salaries: deduction reason, advance, carried unreleased, note
ALTER TABLE staff_salaries ADD COLUMN IF NOT EXISTS deduct_reason text;
ALTER TABLE staff_salaries ADD COLUMN IF NOT EXISTS advance_amount decimal(10,2) NOT NULL DEFAULT 0;
ALTER TABLE staff_salaries ADD COLUMN IF NOT EXISTS carried_unreleased decimal(10,2) NOT NULL DEFAULT 0;
ALTER TABLE staff_salaries ADD COLUMN IF NOT EXISTS note text;
