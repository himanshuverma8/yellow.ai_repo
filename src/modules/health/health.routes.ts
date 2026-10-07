import { Router } from "express";
import { getDbHealth, getHealth } from "./health.controller.js";

export const healthRouter = Router();

healthRouter.get("/", getHealth);
healthRouter.get("/db", getDbHealth);
