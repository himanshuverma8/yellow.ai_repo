import { db, pool } from "./index.js";
import { coupons } from "./schema.js";

const day = 24 * 60 * 60 * 1000;
const inDays = (n: number) => new Date(Date.now() + n * day);

const mockCoupons: (typeof coupons.$inferInsert)[] = [
  { code: "FLASH5", maxRedemptions: 5, discountPercent: 50, expiresAt: inDays(1), type: "STANDARD" },
  { code: "WELCOME10", maxRedemptions: 100, discountPercent: 10, expiresAt: inDays(30), type: "STANDARD" },
  { code: "REFER20", maxRedemptions: 1000, discountPercent: 20, expiresAt: inDays(90), type: "STACKABLE" },
  { code: "LASTONE", maxRedemptions: 1, discountPercent: 25, expiresAt: inDays(7), type: "STACKABLE" },
  { code: "EXPIRED15", maxRedemptions: 50, discountPercent: 15, expiresAt: inDays(-1), type: "STANDARD" },
];

const inserted = await db.insert(coupons).values(mockCoupons).onConflictDoNothing().returning({ code: coupons.code });
console.log(`Seeded ${inserted.length}/${mockCoupons.length} coupons:`, inserted.map((c) => c.code).join(", ") || "-");
await pool.end();
