-- Web orders: store contact type (phone, whatsapp, telegram, facebook, etc.)
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_contact_type" text;
