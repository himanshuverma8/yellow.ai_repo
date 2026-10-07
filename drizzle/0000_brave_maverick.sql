CREATE TYPE "public"."coupon_type" AS ENUM('STANDARD', 'STACKABLE');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('ACTIVE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."redemption_status" AS ENUM('REDEEMED', 'REVERSED');--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "coupons_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"max_redemptions" integer NOT NULL,
	"redeemed_count" integer DEFAULT 0 NOT NULL,
	"discount_percent" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"type" "coupon_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code"),
	CONSTRAINT "coupons_max_redemptions_positive" CHECK ("coupons"."max_redemptions" > 0),
	CONSTRAINT "coupons_discount_percent_range" CHECK ("coupons"."discount_percent" between 1 and 100),
	CONSTRAINT "coupons_redeemed_count_bounds" CHECK ("coupons"."redeemed_count" >= 0 and "coupons"."redeemed_count" <= "coupons"."max_redemptions")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"request_hash" text NOT NULL,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"status" "order_status" DEFAULT 'ACTIVE' NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redemptions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "redemptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"coupon_id" integer NOT NULL,
	"customer_id" text NOT NULL,
	"order_id" text NOT NULL,
	"status" "redemption_status" DEFAULT 'REDEEMED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reversed_at" timestamp with time zone,
	CONSTRAINT "redemptions_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "redemptions_coupon_customer_idx" ON "redemptions" USING btree ("coupon_id","customer_id");