CREATE TABLE "attendance" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" varchar NOT NULL,
	"date" timestamp NOT NULL,
	"check_in" text,
	"check_out" text,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"location" text,
	"contact_person" text,
	"phone" text,
	"email" text,
	"is_active" text DEFAULT 'true' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "branches_name_unique" UNIQUE("name"),
	CONSTRAINT "branches_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"branch_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "due_payment_allocations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" varchar NOT NULL,
	"order_id" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "due_payments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" varchar NOT NULL,
	"payment_date" timestamp NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"unapplied_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"payment_method" text NOT NULL,
	"reference" text,
	"note" text,
	"recorded_by" varchar,
	"branch_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" text NOT NULL,
	"name" text NOT NULL,
	"position" text NOT NULL,
	"department" text NOT NULL,
	"branch_id" varchar,
	"email" text,
	"phone" text,
	"joining_date" timestamp NOT NULL,
	"salary" numeric(10, 2) NOT NULL,
	"photo_url" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "employees_employee_id_unique" UNIQUE("employee_id")
);
--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	CONSTRAINT "expense_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_date" timestamp NOT NULL,
	"category_id" varchar NOT NULL,
	"branch_id" varchar,
	"description" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"unit" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"slip_image" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_adjustments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" varchar NOT NULL,
	"adjustment_type" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"performed_by" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaves" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" varchar NOT NULL,
	"leave_type" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_counters" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"counter_value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"quantity" integer NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"total" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"table_id" varchar,
	"customer_id" varchar,
	"branch_id" varchar,
	"dining_option" text DEFAULT 'dine-in' NOT NULL,
	"customer_name" text,
	"customer_phone" text,
	"order_source" text DEFAULT 'pos' NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"discount_type" text DEFAULT 'amount' NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"due_amount" numeric(10, 2),
	"paid_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"payment_method" text,
	"payment_splits" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "payment_adjustments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_method" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"adjustment_type" text DEFAULT 'add' NOT NULL,
	"description" text,
	"branch_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" varchar NOT NULL,
	"month" text NOT NULL,
	"year" text NOT NULL,
	"base_salary" numeric(10, 2) NOT NULL,
	"bonus" numeric(10, 2) DEFAULT '0' NOT NULL,
	"deductions" numeric(10, 2) DEFAULT '0' NOT NULL,
	"net_salary" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"purchase_cost" numeric(10, 2),
	"category_id" varchar NOT NULL,
	"branch_id" varchar,
	"image_url" text,
	"unit" text DEFAULT 'piece' NOT NULL,
	"description" text,
	"quantity" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_url" text,
	"category_id" varchar NOT NULL,
	"product_id" varchar,
	"branch_id" varchar,
	"item_name" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"purchase_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_name" text DEFAULT 'BondPos POS' NOT NULL,
	"business_logo" text,
	"address" text,
	"phone" text,
	"email" text,
	"date_format" text DEFAULT 'dd-mm-yyyy' NOT NULL,
	"time_format" text DEFAULT '12h' NOT NULL,
	"terminal_id" text,
	"payment_cash" text DEFAULT 'true' NOT NULL,
	"payment_card" text DEFAULT 'true' NOT NULL,
	"payment_aba" text DEFAULT 'true' NOT NULL,
	"payment_acleda" text DEFAULT 'true' NOT NULL,
	"payment_credit" text DEFAULT 'true' NOT NULL,
	"default_payment_method" text DEFAULT 'cash' NOT NULL,
	"min_transaction_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"max_transaction_amount" numeric(10, 2),
	"vat_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"service_tax_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"default_discount" numeric(5, 2) DEFAULT '0' NOT NULL,
	"enable_percentage_discount" text DEFAULT 'true' NOT NULL,
	"enable_fixed_discount" text DEFAULT 'true' NOT NULL,
	"max_discount" numeric(5, 2) DEFAULT '50' NOT NULL,
	"invoice_prefix" text DEFAULT 'INV-' NOT NULL,
	"receipt_header" text,
	"receipt_footer" text,
	"receipt_logo" text,
	"auto_print_receipt" text DEFAULT 'false' NOT NULL,
	"show_logo_on_receipt" text DEFAULT 'true' NOT NULL,
	"include_tax_breakdown" text DEFAULT 'true' NOT NULL,
	"receipt_printer" text DEFAULT 'default' NOT NULL,
	"kitchen_printer" text DEFAULT 'none' NOT NULL,
	"paper_size" text DEFAULT '80mm' NOT NULL,
	"enable_barcode_scanner" text DEFAULT 'false' NOT NULL,
	"enable_cash_drawer" text DEFAULT 'true' NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"secondary_currency" text,
	"secondary_currency_symbol" text,
	"exchange_rate" numeric(10, 2),
	"language" text DEFAULT 'en' NOT NULL,
	"decimal_places" text DEFAULT '2' NOT NULL,
	"rounding_rule" text DEFAULT 'nearest' NOT NULL,
	"currency_symbol_position" text DEFAULT 'before' NOT NULL,
	"auto_backup" text DEFAULT 'true' NOT NULL,
	"backup_frequency" text DEFAULT 'daily' NOT NULL,
	"backup_storage" text DEFAULT 'cloud' NOT NULL,
	"low_stock_alerts" text DEFAULT 'true' NOT NULL,
	"stock_threshold" integer DEFAULT 10 NOT NULL,
	"sale_notifications" text DEFAULT 'false' NOT NULL,
	"discount_alerts" text DEFAULT 'false' NOT NULL,
	"system_update_notifications" text DEFAULT 'true' NOT NULL,
	"notification_email" text,
	"color_theme" text DEFAULT 'orange' NOT NULL,
	"layout_preference" text DEFAULT 'grid' NOT NULL,
	"font_size" text DEFAULT 'medium' NOT NULL,
	"compact_mode" text DEFAULT 'false' NOT NULL,
	"show_animations" text DEFAULT 'true' NOT NULL,
	"perm_access_reports" text DEFAULT 'true' NOT NULL,
	"perm_access_settings" text DEFAULT 'false' NOT NULL,
	"perm_process_refunds" text DEFAULT 'false' NOT NULL,
	"perm_manage_inventory" text DEFAULT 'true' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_salaries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" varchar NOT NULL,
	"salary_date" timestamp NOT NULL,
	"salary_amount" numeric(10, 2) NOT NULL,
	"deduct_salary" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_salary" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tables" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_number" text NOT NULL,
	"capacity" text,
	"description" text,
	"branch_id" varchar,
	"status" text DEFAULT 'available' NOT NULL,
	CONSTRAINT "tables_table_number_unique" UNIQUE("table_number")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"full_name" text NOT NULL,
	"email" text,
	"role" text DEFAULT 'staff' NOT NULL,
	"employee_id" varchar,
	"is_active" text DEFAULT 'true' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
