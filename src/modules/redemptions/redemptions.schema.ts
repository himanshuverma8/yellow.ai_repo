import { z } from "zod";
import { couponCodeSchema, idSchema } from "../../shared/schemas.js";

export const redeemBodySchema = z.object({
  code: couponCodeSchema,
  customer_id: idSchema,
  order_id: idSchema,
});

export const redeemHeadersSchema = z.object({
  "idempotency-key": z.string().trim().min(1).max(255),
});

export type RedeemInput = z.infer<typeof redeemBodySchema>;
