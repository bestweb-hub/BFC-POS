-- Add theme customization columns to settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS "primary_color" text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS "component_size" text NOT NULL DEFAULT 'medium';
