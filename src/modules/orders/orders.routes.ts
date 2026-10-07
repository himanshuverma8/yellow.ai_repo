import { Router } from "express";
import { cancelOrder } from "./orders.controller.js";

export const ordersRouter = Router();

ordersRouter.post("/:order_id/cancel", cancelOrder);
