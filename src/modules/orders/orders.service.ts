import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { coupons, orders, redemptions } from "../../db/schema.js";
import { AppError } from "../../errors/app-error.js";

/**
 * Cancel an order and give its coupon slot back, exactly once.
 *
 * The order row lock makes the ACTIVE -> CANCELLED transition a single winner:
 * a second (or concurrent) cancel sees CANCELLED and is a no-op, so the slot
 * can never be refunded twice. Lock order: order row -> coupon row.
 */
export async function cancelOrder(orderId: string) {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) throw new AppError("ORDER_NOT_FOUND");

    if (order.status === "CANCELLED") {
      return { success: true, already_cancelled: true, coupon_released: false };
    }

    await tx.update(orders).set({ status: "CANCELLED", cancelledAt: new Date() }).where(eq(orders.id, orderId));

    const [redemption] = await tx
      .select()
      .from(redemptions)
      .where(and(eq(redemptions.orderId, orderId), eq(redemptions.status, "REDEEMED")))
      .for("update");

    if (!redemption) {
      return { success: true, already_cancelled: false, coupon_released: false };
    }

    await tx
      .update(coupons)
      .set({ redeemedCount: sql`${coupons.redeemedCount} - 1` })
      .where(eq(coupons.id, redemption.couponId));
    await tx
      .update(redemptions)
      .set({ status: "REVERSED", reversedAt: new Date() })
      .where(eq(redemptions.id, redemption.id));

    return { success: true, already_cancelled: false, coupon_released: true };
  });
}
