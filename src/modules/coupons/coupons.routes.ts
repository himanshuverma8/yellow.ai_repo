import { Router } from "express";
import { createCoupon, getCoupon } from "./coupons.controller.js";

export const couponsRouter = Router();

couponsRouter.post("/", createCoupon);
couponsRouter.get("/:code", getCoupon);
