import { sql } from "drizzle-orm";
import { db } from "../../db/index.js";

export async function checkDatabase() {
  const start = Date.now();
  const result = await db.execute(sql`select now() as now, version() as version`);
  return { latencyMs: Date.now() - start, ...result.rows[0] };
}
