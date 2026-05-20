--> statement-breakpoint
CREATE TABLE "main_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "main_products_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "main_product_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"main_product_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main_product_items" ADD CONSTRAINT "main_product_items_main_product_id_main_products_id_fk" FOREIGN KEY ("main_product_id") REFERENCES "main_products"("id") ON DELETE cascade ON UPDATE no action;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main_product_items" ADD CONSTRAINT "main_product_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade ON UPDATE no action;
END $$;
