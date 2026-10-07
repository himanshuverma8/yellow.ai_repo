import { z } from "zod";

export const idSchema = z.string().trim().min(1).max(128);

// coupon codes are case-insensitive, stored upper-case
export const couponCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Only letters, numbers, '-' and '_' are allowed")
  .transform((code) => code.toUpperCase());
