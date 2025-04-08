CREATE TABLE "app_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"require_2fa" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" integer,
	"stripe_smart_product_id" text,
	"stripe_pro_product_id" text,
	"stripe_smart_monthly_price_id" text,
	"stripe_smart_yearly_price_id" text,
	"stripe_pro_monthly_price_id" text,
	"stripe_pro_yearly_price_id" text
);
--> statement-breakpoint
CREATE TABLE "food_item_tags" (
	"food_item_id" integer NOT NULL,
	"tag_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text,
	"original_name" text,
	"category" text,
	"quantity" numeric(10, 3) NOT NULL,
	"unit" text NOT NULL,
	"location_id" integer NOT NULL,
	"store_id" integer,
	"receiptId" integer,
	"expiry_date" date NOT NULL,
	"price" numeric(10, 2),
	"price_per_unit" numeric(10, 2),
	"is_weight_based" boolean DEFAULT false,
	"normalization_confidence" numeric(5, 4),
	"line_numbers" integer[],
	"purchased" timestamp NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"actor_id" integer
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "permissions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "product_aliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"alias" text NOT NULL,
	"language" text DEFAULT 'en',
	"store_id" integer,
	"confidence" numeric(5, 4) DEFAULT '1.0',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"canonical_name" text NOT NULL,
	"category_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"storeId" integer,
	"filePath" text NOT NULL,
	"fileName" text NOT NULL,
	"fileSize" integer NOT NULL,
	"mimeType" text NOT NULL,
	"uploadDate" timestamp DEFAULT now() NOT NULL,
	"extractedData" jsonb,
	"totalAmount" numeric(10, 2),
	"receiptDate" timestamp,
	"receiptNumber" text,
	"language" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" integer NOT NULL,
	"permission_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "shared_pantry_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer NOT NULL,
	"shared_with_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"phone" text,
	"fax" text,
	"vat_number" text,
	"tax_id" text,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_tiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tier" text NOT NULL,
	"price_monthly" numeric(10, 2) NOT NULL,
	"price_yearly" numeric(10, 2) NOT NULL,
	"max_items" integer NOT NULL,
	"receipt_scans_per_month" integer NOT NULL,
	"max_shared_users" integer NOT NULL,
	"description" text NOT NULL,
	"features" jsonb NOT NULL,
	"stripe_price_id_monthly" text,
	"stripe_price_id_yearly" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#3B82F6',
	"is_system" boolean DEFAULT false,
	"user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"full_name" text,
	"email" text,
	"bio" text,
	"avatar_url" text,
	"role_id" integer,
	"currency" text DEFAULT 'USD',
	"two_factor_enabled" boolean DEFAULT false,
	"two_factor_secret" text,
	"email_notifications" boolean DEFAULT true,
	"web_notifications" boolean DEFAULT true,
	"mention_notifications" boolean DEFAULT true,
	"follow_notifications" boolean DEFAULT true,
	"email_verified" boolean DEFAULT false,
	"verification_token" text,
	"verification_token_expires_at" timestamp,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"subscription_status" text DEFAULT 'inactive',
	"subscription_tier" text DEFAULT 'free',
	"receipt_scans_used" integer DEFAULT 0,
	"receipt_scans_limit" integer DEFAULT 3,
	"max_items" integer DEFAULT 50,
	"max_shared_users" integer DEFAULT 1,
	"current_billing_period_start" timestamp,
	"current_billing_period_end" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_item_tags" ADD CONSTRAINT "food_item_tags_food_item_id_food_items_id_fk" FOREIGN KEY ("food_item_id") REFERENCES "public"."food_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_item_tags" ADD CONSTRAINT "food_item_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_items" ADD CONSTRAINT "food_items_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_items" ADD CONSTRAINT "food_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_items" ADD CONSTRAINT "food_items_receiptId_receipts_id_fk" FOREIGN KEY ("receiptId") REFERENCES "public"."receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_items" ADD CONSTRAINT "food_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_aliases" ADD CONSTRAINT "product_aliases_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_aliases" ADD CONSTRAINT "product_aliases_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_tags_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_storeId_stores_id_fk" FOREIGN KEY ("storeId") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_pantry_users" ADD CONSTRAINT "shared_pantry_users_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_pantry_users" ADD CONSTRAINT "shared_pantry_users_shared_with_id_users_id_fk" FOREIGN KEY ("shared_with_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "food_item_tag_pk" ON "food_item_tags" USING btree ("food_item_id","tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "alias_product_store_idx" ON "product_aliases" USING btree ("product_id","alias","language",COALESCE("store_id", 0));--> statement-breakpoint
CREATE UNIQUE INDEX "canonical_name_idx" ON "products" USING btree ("canonical_name");--> statement-breakpoint
CREATE UNIQUE INDEX "owner_shared_idx" ON "shared_pantry_users" USING btree ("owner_id","shared_with_id");--> statement-breakpoint
CREATE UNIQUE INDEX "store_name_location_user_idx" ON "stores" USING btree ("name","location","user_id");