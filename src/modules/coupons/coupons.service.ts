import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { coupons } from "../../db/schema.js";
import { AppError } from "../../errors/app-error.js";
import type { CreateCouponInput } from "./coupons.schema.js";

export async function createCoupon(input: CreateCouponInput) {
  const [coupon] = await db
    .insert(coupons)
    .values({
      code: input.code,
      maxRedemptions: input.max_redemptions,
      discountPercent: input.discount_percent,
      expiresAt: input.expires_at,
      type: input.type,
    })
    .onConflictDoNothing({ target: coupons.code })
    .returning();

  if (!coupon) throw new AppError("COUPON_ALREADY_EXISTS");
  return coupon;
}

// Single-statement read of the counter row: always reflects every committed
// redemption/cancellation, never a cached or derived value.
export async function getCouponStats(code: string) {
  const [coupon] = await db
    .select({ maxRedemptions: coupons.maxRedemptions, redeemedCount: coupons.redeemedCount })
    .from(coupons)
    .where(eq(coupons.code, code));

  if (!coupon) throw new AppError("COUPON_NOT_FOUND");
  return {
    redeemed_count: coupon.redeemedCount,
    remaining: coupon.maxRedemptions - coupon.redeemedCount,
    max_redemptions: coupon.maxRedemptions,
  };
}
