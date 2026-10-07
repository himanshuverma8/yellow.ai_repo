import type { Request, Response } from "express";
import { redeemBodySchema, redeemHeadersSchema } from "./redemptions.schema.js";
import * as redemptionsService from "./redemptions.service.js";

export async function redeem(req: Request, res: Response) {
  const headers = redeemHeadersSchema.parse(req.headers);
  const input = redeemBodySchema.parse(req.body);

  const { replayed, body } = await redemptionsService.redeemCoupon(input, headers["idempotency-key"]);

  if (replayed) res.set("Idempotent-Replayed", "true");
  res.json(body);
}
