import "dotenv/config";

/**
 * Concurrency proof for the coupon service, run against a live server and the
 * seeded coupons (npm run db:seed).
 *
 *   BASE_URL=http://localhost:3000 npm run test:concurrency
 *
 * Every scenario fires its requests with Promise.all, and cleans up after
 * itself by cancelling the orders it created, so it can be re-run.
 */

const BASE_URL = 'http://localhost:3000';
const runId = Date.now().toString(36);

interface ApiResponse {
  status: number;
  replayed: boolean;
  body: any;
}

async function api(method: "GET" | "POST", path: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(BASE_URL + path, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, replayed: res.headers.get("idempotent-replayed") === "true", body: await res.json() } as ApiResponse;
}

const getStats = async (code: string) => (await api("GET", `/coupons/${code}`)).body;
const redeem = (code: string, customerId: string, orderId: string, key: string) =>
  api("POST", "/redeem", { code, customer_id: customerId, order_id: orderId }, { "Idempotency-Key": key });
const cancel = (orderId: string) => api("POST", `/orders/${orderId}/cancel`);

const outcome = (r: ApiResponse) => (r.body.success ? "SUCCESS" : (r.body.error?.code ?? `HTTP ${r.status}`));
const tally = (rs: ApiResponse[]) =>
  rs.reduce<Record<string, number>>((acc, r) => ({ ...acc, [outcome(r)]: (acc[outcome(r)] ?? 0) + 1 }), {});

let failures = 0;
function check(label: string, ok: boolean, detail: string) {
  if (!ok) failures++;
  console.log(`  ${ok ? "✅ PASS" : "❌ FAIL"}  ${label} — ${detail}`);
}

function guardUsable(rs: ApiResponse[]) {
  const bad = rs.find((r) => ["COUPON_EXPIRED", "COUPON_NOT_FOUND"].includes(r.body.error?.code));
  if (bad) {
    console.error(`\n${bad.body.error.code}: reseed the DB first (truncate tables, then npm run db:seed).`);
    process.exit(2);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
async function testMaxRedemptions() {
  const code = "FLASH5";
  console.log(`\n━━ 1. Burst over max_redemptions on ${code} ━━`);

  const before = await getStats(code);
  const slots = before.remaining;
  const total = slots + 20; // always more requests than there are slots
  console.log(`  before: ${JSON.stringify(before)}`);
  console.log(`  firing ${total} simultaneous POST /redeem (${slots} slots free, distinct customers + orders)…`);

  const orderIds = Array.from({ length: total }, (_, i) => `ord-${runId}-burst-${i}`);
  const results = await Promise.all(
    orderIds.map((orderId, i) => redeem(code, `cust-${runId}-burst-${i}`, orderId, `key-${runId}-burst-${i}`)),
  );
  guardUsable(results);

  const counts = tally(results);
  const after = await getStats(code);
  console.log("  outcomes:", counts);
  console.log(`  after:  ${JSON.stringify(after)}`);

  check("served exactly max_redemptions", (counts.SUCCESS ?? 0) === slots, `${counts.SUCCESS ?? 0} succeeded, ${slots} slots were free`);
  check("every other request rejected", (counts.COUPON_EXHAUSTED ?? 0) === total - slots, `${counts.COUPON_EXHAUSTED ?? 0} × COUPON_EXHAUSTED`);
  check("final count is exact", after.redeemed_count === before.redeemed_count + slots && after.remaining === 0, `redeemed_count ${before.redeemed_count} → ${after.redeemed_count}`);

  // cleanup: give the slots back
  const winners = orderIds.filter((_, i) => results[i].body.success);
  await Promise.all(winners.map(cancel));
  console.log(`  cleanup: cancelled ${winners.length} orders → ${JSON.stringify(await getStats(code))}`);
}

// ─────────────────────────────────────────────────────────────────────────────
async function testIdempotency() {
  const code = "WELCOME10";
  console.log(`\n━━ 2. Same Idempotency-Key retried on ${code} ━━`);

  const before = await getStats(code);
  const customer = `cust-${runId}-idem`;
  const order = `ord-${runId}-idem`;
  const key = `key-${runId}-idem`;
  console.log(`  before: ${JSON.stringify(before)}`);
  console.log("  firing the SAME request (same key) 10× simultaneously, then once more afterwards…");

  const burst = await Promise.all(Array.from({ length: 10 }, () => redeem(code, customer, order, key)));
  guardUsable(burst);
  const late = await redeem(code, customer, order, key);
  const after = await getStats(code);

  console.log("  outcomes:", tally([...burst, late]), `(${[...burst, late].filter((r) => r.replayed).length} served as replays)`);
  console.log(`  after:  ${JSON.stringify(after)}`);

  const all = [...burst, late];
  check("all 11 calls return the same success", all.every((r) => r.body.success && r.body.remaining === before.remaining - 1), `remaining = ${before.remaining - 1} every time`);
  check("charged exactly once", after.redeemed_count === before.redeemed_count + 1, `redeemed_count ${before.redeemed_count} → ${after.redeemed_count}`);

  await cancel(order);
  console.log(`  cleanup: cancelled → ${JSON.stringify(await getStats(code))}`);
}

// ─────────────────────────────────────────────────────────────────────────────
async function testDoubleCancel() {
  const code = "REFER20";
  console.log(`\n━━ 3. Cancel the same order twice on ${code} ━━`);

  const before = await getStats(code);
  const orderA = `ord-${runId}-cancelA`;
  const orderB = `ord-${runId}-cancelB`;
  const [a, b] = await Promise.all([
    redeem(code, `cust-${runId}-cancelA`, orderA, `key-${runId}-cancelA`),
    redeem(code, `cust-${runId}-cancelB`, orderB, `key-${runId}-cancelB`),
  ]);
  guardUsable([a, b]);
  const held = await getStats(code);
  console.log(`  before: ${JSON.stringify(before)}`);
  console.log(`  after 2 redemptions (order A + order B): ${JSON.stringify(held)}`);
  console.log("  firing cancel(order A) 8× simultaneously, then once more afterwards…");

  const burst = await Promise.all(Array.from({ length: 8 }, () => cancel(orderA)));
  const late = await cancel(orderA);
  const after = await getStats(code);

  const released = [...burst, late].filter((r) => r.body.coupon_released).length;
  console.log(`  cancel responses: ${released} released the slot, ${9 - released} were no-ops`);
  console.log(`  after:  ${JSON.stringify(after)}`);

  check("slot returned exactly once", released === 1, `${released} of 9 cancel calls released it`);
  check("count decremented by 1, not 2+", after.redeemed_count === held.redeemed_count - 1, `redeemed_count ${held.redeemed_count} → ${after.redeemed_count} (order B still holds its slot)`);

  await cancel(orderB);
  console.log(`  cleanup: cancelled order B → ${JSON.stringify(await getStats(code))}`);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(`Coupon concurrency test → ${BASE_URL} (run ${runId})`);
try {
  await testMaxRedemptions();
  await testIdempotency();
  await testDoubleCancel();
} catch (err) {
  console.error(`\nCould not complete the test against ${BASE_URL}:`, err instanceof Error ? err.message : err);
  process.exit(2);
}

console.log(failures === 0 ? "\n🎉 All concurrency checks passed" : `\n💥 ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
