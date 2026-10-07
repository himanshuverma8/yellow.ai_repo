import { createHash } from "node:crypto";
import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { coupons, customers, idempotencyKeys, orders, redemptions } from "../../db/schema.js";
import { AppError } from "../../errors/app-error.js";
import type { RedeemInput } from "./redemptions.schema.js";

export interface RedeemResult {
  replayed: boolean;
  body: { success: true; remaining: number };
}

function hashRequest({ code, customer_id, order_id }: RedeemInput): string {
  return createHash("sha256").update(JSON.stringify([code, customer_id, order_id])).digest("hex");
}

/**
 * Everything runs in ONE transaction, so the idempotency key, the counter and
 * the redemption row commit (or roll back) together.
 *
 * Lock order is always  order row -> coupon row  (same as cancelOrder), so
 * redeem and cancel can never deadlock each other. The coupon row lock
 * serialises all redemptions of a coupon: that is what makes max_redemptions
 * and the once-per-customer rule safe under a burst of concurrent requests.
 */
export async function redeemCoupon(input: RedeemInput, idempotencyKey: string): Promise<RedeemResult> {
  const requestHash = hashRequest(input);

  return db.transaction(async (tx) => {
    // 1. Claim the idempotency key. A concurrent request with the same key
    //    blocks here on the unique index until the first one commits/rolls back.
    const [claimed] = await tx
      .insert(idempotencyKeys)
      .values({ key: idempotencyKey, requestHash })
      .onConflictDoNothing()
      .returning({ key: idempotencyKeys.key });

    if (!claimed) {
      const [existing] = await tx.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, idempotencyKey));
      if (existing?.requestHash !== requestHash) throw new AppError("IDEMPOTENCY_KEY_REUSED");
      if (!existing.response) throw new AppError("INTERNAL_ERROR");
      return { replayed: true, body: existing.response };
    }

    // 2. Make sure customer + order exist, then lock the order row.
    await tx.insert(customers).values({ id: input.customer_id }).onConflictDoNothing();
    await tx.insert(orders).values({ id: input.order_id, customerId: input.customer_id }).onConflictDoNothing();
    const [order] = await tx.select().from(orders).where(eq(orders.id, input.order_id)).for("update");

    if (order.customerId !== input.customer_id) throw new AppError("ORDER_CUSTOMER_MISMATCH");
    if (order.status === "CANCELLED") throw new AppError("ORDER_CANCELLED");

    const [orderRedemption] = await tx
      .select({ id: redemptions.id })
      .from(redemptions)
      .where(eq(redemptions.orderId, input.order_id));
    if (orderRedemption) throw new AppError("ORDER_ALREADY_HAS_COUPON");

    // 3. Lock the coupon row. Expiry is decided by the DB clock *after* the
    //    lock is acquired, so redemptions are totally ordered against expiry:
    //    expired  <=>  expires_at <= instant the lock was granted.
    const [coupon] = await tx
      .select({ ...getTableColumns(coupons), expired: sql<boolean>`${coupons.expiresAt} <= clock_timestamp()` })
      .from(coupons)
      .where(eq(coupons.code, input.code))
      .for("update");

    if (!coupon) throw new AppError("COUPON_NOT_FOUND");
    if (coupon.expired) throw new AppError("COUPON_EXPIRED");

    if (coupon.type === "STANDARD") {
      const [previous] = await tx
        .select({ id: redemptions.id })
        .from(redemptions)
        .where(
          and(
            eq(redemptions.couponId, coupon.id),
            eq(redemptions.customerId, input.customer_id),
            eq(redemptions.status, "REDEEMED"),
          ),
        )
        .limit(1);
      if (previous) throw new AppError("COUPON_ALREADY_USED");
    }

    if (coupon.redeemedCount >= coupon.maxRedemptions) throw new AppError("COUPON_EXHAUSTED");

    // 4. Commit the redemption.
    await tx
      .update(coupons)
      .set({ redeemedCount: sql`${coupons.redeemedCount} + 1` })
      .where(eq(coupons.id, coupon.id));
    await tx.insert(redemptions).values({
      couponId: coupon.id,
      customerId: input.customer_id,
      orderId: input.order_id,
    });

    const body = { success: true as const, remaining: coupon.maxRedemptions - coupon.redeemedCount - 1 };
    await tx.update(idempotencyKeys).set({ response: body }).where(eq(idempotencyKeys.key, idempotencyKey));

    return { replayed: false, body };
  });
}
