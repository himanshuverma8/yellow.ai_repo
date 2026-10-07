import type { Request, Response } from "express";
import { orderParamsSchema } from "./orders.schema.js";
import * as ordersService from "./orders.service.js";

export async function cancelOrder(req: Request, res: Response) {
  const { order_id } = orderParamsSchema.parse(req.params);
  res.json(await ordersService.cancelOrder(order_id));
}
