# Lab Equipment Checkout — every step, in simple English

Read this before the follow-up session. Each step says what it does,
why, and which file to open if they ask about it.

## Step 1 — The database (schema + seeds)

**Files:** `backend/db/migrations/001_init.sql`, `backend/db/seeds/seed.sql`

Three tables:
- `users` — id, name, role (`student` or `assistant`). Five seeded users.
- `equipment` — id, name, total_units, retired. Names are unique
  ignoring upper/lower case (`Oscilloscope` = `oscilloscope`).
- `checkouts` — id, equipment_id, user_id, borrowed_at, due_at,
  returned_at. A checkout belongs to one item and one user (foreign keys).

Indexes (why each one exists):
- `lower(name)` — makes the name rule real, in the database.
- active checkouts per item — every "how many are free?" question uses it.
- `(user_id, borrowed_at, id)` — "my checkouts" lists, newest first.
- overdue scan — the report's overdue count.

**Run it:** `docker compose up -d db`, or `npm run migrate` + the seed file.

## Step 2 — The API (borrow, return, rules)

**Files:** `backend/src/app.ts`, `backend/src/routes/*.ts`,
`backend/src/middleware/auth.ts`, `backend/src/db.ts`

- `app.ts` — wires everything: JSON parsing, `/health`, auth on `/api/*`.
- `auth.ts` — reads the `X-User-Id` header, looks the user up, says 401
  if unknown. `canAccessCheckout` is the ownership rule: assistants can
  touch anyone's checkout, students only their own.
- `equipment.ts` — list (available = total − active checkouts, computed
  in SQL), create (assistants only, duplicate name → 409), retire.
- `checkouts.ts` — borrow, list (paginated), view one, return.
- `report.ts` — one query: `LEFT JOIN` + `SUM(CASE WHEN ...)` for checked
  out and overdue per item.
- `db.ts` — one Postgres pool and a small `query` helper. Borrow and
  return open a transaction themselves with BEGIN, COMMIT and ROLLBACK.

**The two rules that matter most:**
1. *Stock never below zero.* Borrow locks the equipment row
   (`SELECT … FOR UPDATE`), counts active checkouts, and only then
   inserts — all in one transaction. Two students racing for the last
   unit: one gets 201, the other 409 `NOT_AVAILABLE`.
2. *Due in 7 days.* `due_at = now() + 7 days` at insert time. Overdue =
   not returned and `due_at` has passed.

**Errors** are always `{ error: { code, message } }` with the right
status: 400 bad input, 401 unknown user, 403 not yours, 404 not found,
409 conflict (not available / duplicate / already returned).

## Step 3 — Tests

**Files:** `backend/tests/*.ts` — 19 tests, 4 files.

- `equipment.test.ts` — list, create, student 403, duplicate 409,
  bad input 400, malformed JSON 400, retire blocks borrow.
- `checkouts.test.ts` — borrow (due = +7 days), last-unit 409,
  ownership 403s, return + second return 409, pagination.
- `report.test.ts` — checked-out and overdue counts from the real query.
- `concurrency.test.ts` — two parallel borrows for the last unit,
  exactly one succeeds.

**Run them:** `cd backend`, then
`TEST_DATABASE_URL=postgres://lab:lab@localhost:5432/lab_checkout_test npm test`.
The setup refuses to run unless the URL points at the test database,
so tests can never wipe your dev data.

## Step 4 — The React screens

**Files:** `frontend/src/App.tsx`, `frontend/src/api.ts`

Three tabs: Equipment, My checkouts, Usage report. The top-right
dropdown picks which seeded user you act as (it just sets the
`X-User-Id` header — no login, per the brief).

- *Equipment:* add form (assistants only) with client validation and
  server errors shown inline; list with loading / empty / error /
  success states; Borrow button disabled when none are free or the
  item is retired; Retire button for assistants.
- *My checkouts:* Return button, red Overdue badge, pagination.
- *Usage report:* bar chart (blue = checked out, red = overdue) + table.

Borrow/Return/Retire buttons disable themselves while the request is
in flight, so a double-click cannot borrow twice.

## Step 5 — Running it

See `README.md` (5 steps). In short: Postgres via Docker Compose,
`npm install` + `npm run dev` in `backend`, same in `frontend`.
API on `:4000`, web app on `:5173`.

## Step 6 — Docs and CI

`README.md` (run + API table), `DECISIONS.md` (5 decisions with
alternatives), `PREVIOUS_WORK.md` (DraftShot), `AI_USAGE.md` (this
honest note). CI (`.github/workflows/ci.yml`, also in the ZIP) runs
typecheck + tests on Postgres 16 + frontend build + Docker build on
every push.
