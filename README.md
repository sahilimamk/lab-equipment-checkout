# Lab Equipment Checkout

**Repo:** https://github.com/sahilimamk/lab-equipment-checkout

**Live demo:** website https://lab-equipment-web-exus.onrender.com
· API https://lab-equipment-api.onrender.com (try `/health`).
Hosted on Render's free tier in its own workspace, so the free API
sleeps after 15 minutes of no use — the first click after a quiet
period can take about a minute to wake up.

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
| POST | `/api/ai/tip` | anyone | `{equipment_id, task}` → short Gemini tip; no key → 503 |
| GET | `/health` | — | no auth |

Errors are always `{ "error": { "code": "...", "message": "..." } }`.

## Tests

```bash
cd backend
createdb lab_checkout_test
TEST_DATABASE_URL=postgres://lab:lab@localhost:5432/lab_checkout_test npm test
```

No `createdb` on your machine (Docker-only setup):

```bash
docker compose exec db createdb -U lab lab_checkout_test
```

Covers: equipment list/create + duplicate + validation, borrow/return,
ownership (403s), pagination, report counts, a concurrent-race test
where two students request the last unit — exactly one succeeds — and
the AI tip endpoint returning 503 without a key.

## Optional AI feature (stretch 13)

A small "Ask AI" box on the Equipment screen calls Gemini for a short
tip about an item for a job. It is separate from the Must items: without
a key it answers 503 and everything else still works. To turn it on,
add `GEMINI_API_KEY=your-key` to `backend/.env` and restart the API.
Get a key from Google AI Studio (free tier). It uses
`gemini-3.8-flash` — the model Google's own API names as the current
one, verified live with a real key. Note: Gemini is currently refusing
requests for this model (free-tier quota / high demand), so the box
answers "try again later" until that clears.

## What is done / not done

Done — all Must items (1–6), all Should items 7–10, and stretch 11
(concurrency test), 12 (usage chart on the report screen) and 13
(Gemini tip, optional).
Not done — nothing the brief asks for is missing.

See `DECISIONS.md`, `PREVIOUS_WORK.md`, `AI_USAGE.md`.
