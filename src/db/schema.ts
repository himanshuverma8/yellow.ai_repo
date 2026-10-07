import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const couponType = pgEnum("coupon_type", ["STANDARD", "STACKABLE"]);
export const orderStatus = pgEnum("order_status", ["ACTIVE", "CANCELLED"]);
export const redemptionStatus = pgEnum("redemption_status", ["REDEEMED", "REVERSED"]);

export const coupons = pgTable(
  "coupons",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    code: text().notNull().unique(),
    maxRedemptions: integer("max_redemptions").notNull(),
    redeemedCount: integer("redeemed_count").notNull().default(0),
    discountPercent: integer("discount_percent").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    type: couponType().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check("coupons_max_redemptions_positive", sql`${t.maxRedemptions} > 0`),
    check("coupons_discount_percent_range", sql`${t.discountPercent} between 1 and 100`),
    // last line of defence: the counter can never go negative or past the limit
    check("coupons_redeemed_count_bounds", sql`${t.redeemedCount} >= 0 and ${t.redeemedCount} <= ${t.maxRedemptions}`),
  ],
);

export const customers = pgTable("customers", {
  id: text().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: text().primaryKey(),
  customerId: text("customer_id")
    .notNull()
    .references(() => customers.id),
  status: orderStatus().notNull().default("ACTIVE"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const redemptions = pgTable(
  "redemptions",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    couponId: integer("coupon_id")
      .notNull()
      .references(() => coupons.id),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    // one redemption per order, ever
    orderId: text("order_id")
      .notNull()
      .unique()
      .references(() => orders.id),
    status: redemptionStatus().notNull().default("REDEEMED"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
  },
  (t) => [index("redemptions_coupon_customer_idx").on(t.couponId, t.customerId)],
);

export const idempotencyKeys = pgTable("idempotency_keys", {
  key: text().primaryKey(),
  requestHash: text("request_hash").notNull(),
  response: jsonb().$type<{ success: true; remaining: number }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
