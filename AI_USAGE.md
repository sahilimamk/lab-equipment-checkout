# AI usage

**Tool used:** Muse (Meta's personal AI assistant), in build sessions on
14 and 16 November 2026.

**How the work was split:** I led the work. I read the brief, sketched
the tables, set the plan step by step, made every decision in
`DECISIONS.md`, and reviewed every endpoint against the brief's rules
(stock never below zero, ownership, 7-day due date, case-insensitive
names) before it went in. I knew what each step had to do before it was
written. Muse did the repetitive, typing-heavy work for me: drafting the
routes, the SQL, the React screens, the test files, Docker Compose and
the CI workflow, in the shape I had already decided.

**Where AI output was wrong or unhelpful, and how I noticed:**
1. The first draft of `docker-compose.yml` mounted the migration and
   seed files into the Postgres init directory but the `api` service
   was also started by default — without a built backend image that
   made `docker compose up` fail on a fresh checkout. I noticed it
   while reading the file before running it, and put the `api` service
   behind the `with-api` profile so `docker compose up -d db` (the
   README's step 1) works on its own.
2. An early version of the test setup assumed the test database already
   existed and the migration had been applied. Running `npm test` on a
   clean database failed immediately with "relation does not exist".
   That failure is what led to the `beforeAll` migration + seed in
   `tests/setup.ts`.
3. Two more mistakes surfaced only when separate review passes read
   the code back: the report test backdated `due_at` without backdating
   `borrowed_at`, which violates the migration's own
   `CHECK (due_at > borrowed_at)` and would fail every run; and the
   README told the reader to copy `.env.example` to `.env` while
   nothing in the code ever loaded a `.env` file. Both were fixed
   after the review (test backdates both columns; `dotenv` added and
   loaded in `src/db.ts` and `scripts/migrate.js`).
4. A live run caught one more: `npm run build` emitted
   `dist/src/index.js` instead of `dist/index.js` because the
   TypeScript config included the test files, so the server would not
   start from the built output. Fixed with a build-only tsconfig and
   a separate test tsconfig; the build and all tests were re-run
   after the fix.
5. When I rewrote the code in a plain beginner style on 16 November, I
   caught a mistake in my own rewrite of the report: my first version
   used `SUM(CASE WHEN c.returned_at IS NULL ...)` on a `LEFT JOIN`,
   which counts an item with no checkouts as 1 checked out, because
   the joined row is all NULL and NULL passes the `IS NULL` check. The
   report test caught it (an untouched item must show 0). Fixed by
   adding `c.id IS NOT NULL` to the check, and the test passes now.

**What I wrote entirely myself:** the plan and the order of work, the
decisions in `DECISIONS.md` (including the retire semantics, decision
5), the honest `PREVIOUS_WORK.md` note about DraftShot's starter
auth/leaderboard, the plain-style rewrite of the code on 16 November
(no comments, no hidden helpers, transactions shown in the routes), and
the final review of every endpoint against the brief. The decisions and
the checking are mine; the AI did the repetitive drafting and typing.

**The AI feature in this project:** the "Ask AI" tip box calls the
Gemini API (`gemini-2.0-flash`) from `backend/src/routes/ai.ts`. It is
a small extra I chose, kept apart from the Must items, and it is off
without a `GEMINI_API_KEY`. I decided what it should do, what it
should ask, and that it must fail clearly with 503 instead of breaking
anything.
