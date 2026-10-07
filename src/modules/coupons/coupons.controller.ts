import type { Request, Response } from "express";
import { couponParamsSchema, createCouponSchema } from "./coupons.schema.js";
import * as couponsService from "./coupons.service.js";

export async function createCoupon(req: Request, res: Response) {
  const input = createCouponSchema.parse(req.body);
  const coupon = await couponsService.createCoupon(input);
  res.status(201).json({
    code: coupon.code,
    max_redemptions: coupon.maxRedemptions,
    redeemed_count: coupon.redeemedCount,
    discount_percent: coupon.discountPercent,
    expires_at: coupon.expiresAt,
    type: coupon.type,
  });
}

export async function getCoupon(req: Request, res: Response) {
  const { code } = couponParamsSchema.parse(req.params);
  res.json(await couponsService.getCouponStats(code));
}
