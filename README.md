# Lab Equipment Checkout

Students borrow lab equipment (oscilloscopes, multimeters, dev boards).
Lab assistants manage the inventory. A checkout is due 7 days after it
starts; after that it is overdue.

Stack: **React + Vite + TypeScript** (frontend) · **Node.js + TypeScript +
Express + PostgreSQL** (API) · **Jest + Supertest** (tests).

## How to run it (5 steps)

```bash
docker compose up -d db                          # 1. start Postgres (seeds users + equipment)
cd backend && npm install && cp .env.example .env  # 2. install API deps + load DB settings
npm run migrate                                  # 3. apply schema (already applied by Compose on first start; safe to re-run)
npm run dev                                      # 4. start the API on http://localhost:4000 (leave running)
cd ../frontend && npm install && npm run dev     # 5. in a second terminal: web app on http://localhost:5173
```

The `.env` file sets `DATABASE_URL=postgres://lab:lab@localhost:5432/lab_checkout_dev`
(the same `lab`/`lab` user Compose creates) and is loaded automatically
by the API via `dotenv`. Tests use `TEST_DATABASE_URL`
(`postgres://lab:lab@localhost:5432/lab_checkout_test`).

> Port note: if you already run Postgres on port 5432 (e.g. a local
> install), stop it first or change the `db` port mapping in
> `docker-compose.yml` to `"5433:5432"` and the port in `.env` to `5433`.

No Docker? Use a local Postgres instead:

```bash
cd backend && npm install && cp .env.example .env
createdb lab_checkout_dev
npm run migrate
psql "postgres://lab:lab@localhost:5432/lab_checkout_dev" -f db/seeds/seed.sql
npm run dev
```

To run the API in Docker too: `docker compose --profile with-api up --build`.

## Demo "login"

There is no sign-up/login by design (brief §2). Pick a seeded user in the
top-right of the web app — it sends that user's id as the `X-User-Id`
header. Seeded users: `stu-aria`, `stu-rohan`, `stu-meera` (students),
`asst-rahul`, `asst-priya` (assistants).

## API (all `/api/*` need `X-User-Id`)

| Method | Endpoint | Who | Notes |
|---|---|---|---|
| GET | `/api/equipment` | anyone | list with `available_units` |
| POST | `/api/equipment` | assistant | `{name, total_units}`; duplicate name (any case) → 409 |
| PATCH | `/api/equipment/:id/retire` | assistant | retired items can't be borrowed |
| POST | `/api/checkouts` | anyone | `{equipment_id}` → 201, due in 7 days; none left → 409 `NOT_AVAILABLE` |
| GET | `/api/checkouts?page=1&limit=20&status=all` | anyone | students see only their own; stable order `borrowed_at DESC, id DESC` |
| GET | `/api/checkouts/:id` | owner / assistant | |
| POST | `/api/checkouts/:id/return` | owner / assistant | already returned → 409 |
| GET | `/api/report/equipment-usage` | anyone | per item: checked out + overdue (JOIN + aggregate) |
| GET | `/health` | — | no auth |

Errors are always `{ "error": { "code": "...", "message": "..." } }`.

## Tests

```bash
cd backend
createdb lab_checkout_test
TEST_DATABASE_URL=postgres://lab:lab@localhost:5432/lab_checkout_test npm test
```

Covers: equipment list/create + duplicate + validation, borrow/return,
ownership (403s), pagination, report counts, and a concurrent-race test
where two students request the last unit — exactly one succeeds.

## What is done / not done

Done — all Must items (1–6) and Should items 7–10, plus stretch 11
(concurrency test) and 12 (usage chart on the report screen).
Not done — stretch 13 (no AI feature; kept the submission focused on the
Must/Should items, see DECISIONS.md).

See `DECISIONS.md`, `PREVIOUS_WORK.md`, `AI_USAGE.md`.
