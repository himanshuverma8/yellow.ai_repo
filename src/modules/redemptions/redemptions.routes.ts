import { Router } from "express";
import { redeem } from "./redemptions.controller.js";

export const redemptionsRouter = Router();

redemptionsRouter.post("/", redeem);
