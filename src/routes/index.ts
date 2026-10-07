import { Router } from "express";
import { couponsRouter } from "../modules/coupons/coupons.routes.js";
import { healthRouter } from "../modules/health/health.routes.js";
import { ordersRouter } from "../modules/orders/orders.routes.js";
import { redemptionsRouter } from "../modules/redemptions/redemptions.routes.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/coupons", couponsRouter);
apiRouter.use("/redeem", redemptionsRouter);
apiRouter.use("/orders", ordersRouter);
