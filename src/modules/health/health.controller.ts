import type { Request, Response } from "express";
import { checkDatabase } from "./health.service.js";

export function getHealth(_req: Request, res: Response) {
  res.json({ status: "ok", uptime: process.uptime() });
}

export async function getDbHealth(_req: Request, res: Response) {
  try {
    const result = await checkDatabase();
    res.json({ status: "ok", db: "connected", ...result });
  } catch (err) {
    res.status(503).json({
      status: "error",
      db: "disconnected",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
