import { z } from "zod";
import { couponCodeSchema } from "../../shared/schemas.js";

export const createCouponSchema = z.object({
  code: couponCodeSchema,
  max_redemptions: z.number().int().positive().max(2_147_483_647),
  discount_percent: z.number().int().min(1).max(100),
  expires_at: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
  type: z.enum(["STANDARD", "STACKABLE"]),
});

export const couponParamsSchema = z.object({ code: couponCodeSchema });

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
