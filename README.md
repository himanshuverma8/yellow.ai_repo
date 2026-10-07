# Coupon Redemption Service

Express + TypeScript API for creating and redeeming coupons safely under concurrent load. Uses Postgres (via Docker Compose) and Drizzle ORM, with zod request validation.

## Prerequisites

- Node.js 20+ (developed on Node 24)
- npm
- Docker with Docker Compose

## Setup

```bash
# 1. Clone and install
git clone https://github.com/himanshuverma8/yellow.ai_repo.git
cd yellow.ai_repo
npm install

# 2. Create your env file
cp .env.example .env

# 3. Start Postgres in Docker (see "PostgreSQL with Docker Compose" below)
docker compose pull postgres
npm run db:up

# 4. Create the tables
npm run db:migrate

# 5. Load sample coupons
npm run db:seed

# 6. Start the API (hot reload)
npm run dev
```

Check it works:

```bash
curl http://localhost:3000/health/db
# {"status":"ok","db":"connected",...}
```

## PostgreSQL with Docker Compose

The database runs from the official `postgres:17-alpine` image defined in `docker-compose.yml`. You don't build an image yourself: Docker downloads the official one from Docker Hub the first time.

**1. Make sure Docker is running**

```bash
docker --version
docker compose version
```

Start Docker Desktop (or the Docker daemon) if these fail.

**2. Create `.env` first**

Compose reads `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` and `POSTGRES_PORT` from `.env`:

```bash
cp .env.example .env
```

**3. Pull the image**

```bash
docker compose pull postgres
docker images postgres      # should list postgres:17-alpine
```

**4. Create and start the container**

```bash
docker compose up -d --wait   # same as: npm run db:up (plus --wait)
```

This creates a container named `yellow_ai_postgres`, a named volume for the data, and publishes Postgres on host port `3008`. `--wait` returns once the container's healthcheck (`pg_isready`) passes.

**5. Verify it's running**

```bash
docker compose ps             # STATUS should show "healthy"
docker compose logs postgres  # look for "database system is ready to accept connections"
```

**6. Connect with psql (optional)**

```bash
docker exec -it yellow_ai_postgres psql -U postgres -d yellow_ai
```

Inside psql, `\dt` lists tables (empty until you run `npm run db:migrate`) and `\q` exits.

**Day-to-day commands**

| Command | Effect |
|---|---|
| `npm run db:up` | Start the container (data is kept) |
| `npm run db:down` | Stop and remove the container (data is kept in the volume) |
| `npm run db:down -- -v` | Stop and delete the volume, wiping all data |
| `docker compose logs -f postgres` | Follow the database logs |

The container uses `restart: unless-stopped`, so it comes back automatically when Docker restarts unless you stopped it.

## Environment variables

Defined in `.env` (copy from `.env.example`). The app validates them with zod at startup and exits with a clear message if one is missing.

| Variable | Default | Used by |
|---|---|---|
| `PORT` | `3000` | API server |
| `POSTGRES_USER` | `postgres` | Docker Compose |
| `POSTGRES_PASSWORD` | `postgres` | Docker Compose |
| `POSTGRES_DB` | `yellow_ai` | Docker Compose |
| `POSTGRES_PORT` | `3008` | Host port Postgres is published on |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:3008/yellow_ai` | API, Drizzle, seed script |

If port 3000 or 3008 is already used on your machine, change `PORT` or `POSTGRES_PORT`. If you change `POSTGRES_PORT`, update the port in `DATABASE_URL` too.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the API with hot reload |
| `npm run build` | Compile `src/` to `dist/` |
| `npm start` | Run the compiled build |
| `npm run typecheck` | Type-check the app, scripts and config |
| `npm run db:up` / `db:down` | Start / stop the Postgres container |
| `npm run db:generate` | Generate a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Insert sample coupons (safe to re-run) |
| `npm run db:studio` | Open Drizzle Studio to browse the DB |
| `npm run test:concurrency` | Run the concurrency test against a running server |

## Seeded coupons

| Code | Type | Max redemptions | Discount | Expires |
|---|---|---|---|---|
| `FLASH5` | STANDARD | 5 | 50% | 1 day after seeding |
| `WELCOME10` | STANDARD | 100 | 10% | 30 days |
| `REFER20` | STACKABLE | 1000 | 20% | 90 days |
| `LASTONE` | STACKABLE | 1 | 25% | 7 days |
| `EXPIRED15` | STANDARD | 50 | 15% | already expired |

To reset all data and reseed:

```bash
npm run db:down -- -v   # removes the DB volume
npm run db:up && npm run db:migrate && npm run db:seed
```

## API

| Method | Path | Body / headers | Success response |
|---|---|---|---|
| `GET` | `/health` | – | `{ status, uptime }` |
| `GET` | `/health/db` | – | `{ status, db, latencyMs, now, version }` |
| `POST` | `/coupons` | `{ code, max_redemptions, discount_percent, expires_at, type }` | `201` with the coupon |
| `GET` | `/coupons/:code` | – | `{ redeemed_count, remaining, max_redemptions }` |
| `POST` | `/redeem` | header `Idempotency-Key`; body `{ code, customer_id, order_id }` | `{ success: true, remaining }` |
| `POST` | `/orders/:order_id/cancel` | – | `{ success, already_cancelled, coupon_released }` |

Example:

```bash
curl -X POST http://localhost:3000/redeem \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-1" \
  -d '{"code":"WELCOME10","customer_id":"cust-1","order_id":"ord-1"}'
```

### Rules enforced

- A coupon is never redeemed more than `max_redemptions` times, even under bursts of simultaneous requests.
- A `STANDARD` coupon can be redeemed once per customer. A `STACKABLE` coupon has no per-customer limit.
- Expired coupons are rejected. Expiry is checked against the database clock while the coupon row is locked, so requests at the expiry instant resolve consistently.
- Cancelling an order returns its coupon slot exactly once; repeat cancels are no-ops.
- Retrying `POST /redeem` with the same `Idempotency-Key` returns the original response (with header `Idempotent-Replayed: true`) without redeeming again. Reusing a key with a different body is rejected.
- Customers and orders are created automatically on their first redemption.

### Errors

All errors share one shape:

```json
{ "error": { "code": "COUPON_EXHAUSTED", "type": "CONFLICT", "description": "No redemptions left for this coupon" } }
```

| Code | Status | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid body or params (`details` lists each field) |
| `MALFORMED_JSON` | 400 | Body is not valid JSON |
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | `Idempotency-Key` header missing |
| `COUPON_NOT_FOUND` | 404 | Unknown coupon code |
| `COUPON_ALREADY_EXISTS` | 409 | Creating a duplicate code |
| `COUPON_ALREADY_USED` | 409 | Customer already redeemed this STANDARD coupon |
| `COUPON_EXHAUSTED` | 409 | No redemptions left |
| `COUPON_EXPIRED` | 422 | Coupon is past `expires_at` |
| `ORDER_NOT_FOUND` | 404 | Cancelling an unknown order |
| `ORDER_CANCELLED` | 422 | Redeeming on a cancelled order |
| `ORDER_CUSTOMER_MISMATCH` | 422 | Order belongs to another customer |
| `ORDER_ALREADY_HAS_COUPON` | 409 | Order already has a redemption |
| `IDEMPOTENCY_KEY_REUSED` | 422 | Same key sent with a different body |
| `ROUTE_NOT_FOUND` | 404 | Unknown route |
| `INTERNAL_ERROR` | 500 | Unexpected failure |

The full catalog lives in `src/errors/error-catalog.ts`.

## Testing

**Concurrency test.** With the server running and the DB seeded:

```bash
npm run test:concurrency
# or point it at another port:
BASE_URL=http://localhost:3010 npm run test:concurrency
```

It fires simultaneous requests with `Promise.all` and checks that:

1. More redeems than `max_redemptions` on `FLASH5` serve exactly the free slots and reject the rest.
2. The same `Idempotency-Key` sent repeatedly on `WELCOME10` redeems only once.
3. Cancelling the same order repeatedly on `REFER20` returns the slot only once.

It cancels the orders it creates, so it can be run repeatedly. Exit code is `0` on success, `1` on a failed check, `2` if the server is unreachable or the seed data is missing or expired.

**Postman.** Import `postman/coupon-service.postman_collection.json`, set the `baseUrl` collection variable, and run the whole collection in order with the Collection Runner. Each run uses fresh IDs, so it can be repeated without resetting the DB.

## Project structure

```
src/
  index.ts              # starts the server
  app.ts                # express app, routes, error middleware
  config/env.ts         # zod-validated environment
  db/
    schema.ts           # tables: coupons, customers, orders, redemptions, idempotency_keys
    index.ts            # pg pool + drizzle client
    seed.ts             # sample coupons
  errors/               # AppError + error catalog
  middlewares/          # central error handler
  routes/index.ts       # mounts module routers
  shared/schemas.ts     # shared zod schemas
  modules/
    coupons/            # *.schema.ts, *.service.ts, *.controller.ts, *.routes.ts
    redemptions/
    orders/
    health/
scripts/concurrency-test.ts
postman/coupon-service.postman_collection.json
drizzle/                # generated SQL migrations
```

## Troubleshooting

- **`Invalid environment variables` on start:** `.env` is missing or incomplete. Copy `.env.example` to `.env`.
- **`port is already allocated` from Docker:** another process uses 3008. Change `POSTGRES_PORT` and the port in `DATABASE_URL`.
- **Requests return unexpected responses on port 3000:** another app may be listening there. Set a different `PORT` in `.env`.
- **`COUPON_EXPIRED` for `FLASH5` in the concurrency test:** it expires one day after seeding. Reset and reseed as shown above.
- **Editor shows `Cannot find name 'process'`:** run "TypeScript: Restart TS Server" in VS Code.
