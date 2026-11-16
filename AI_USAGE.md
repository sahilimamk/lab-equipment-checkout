# AI usage

**Tools used:** Claude and Muse (Meta's personal AI assistant), in build
sessions on 14 and 16 November 2026. Claude helped with planning and
thinking through the design; Muse drafted code from that design.

**How the work was split:** I led the work and made the major decisions.
I read the brief, sketched the tables, set the plan step by step, and
decided the design — the schema, the borrow transaction with the row
lock, computed availability, the ownership rules, the report query —
and every decision in `DECISIONS.md`. Claude helped me think through
the plan and the design, including the schema and the borrow-transaction
design. Muse drafted the code from that design: the routes, the SQL,
the React screens, the test files, Docker Compose and the CI workflow.
I reviewed every endpoint against the brief's rules (stock never below
zero, ownership, 7-day due date, case-insensitive names) before it went
in. I did not do this on my own — the drafting was AI's, the design
and decisions were mine.

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
5. When the code was rewritten in a plain beginner style on 16
   November, the first version of the report used `SUM(CASE WHEN
   c.returned_at IS NULL ...)` on a `LEFT JOIN`, which counts an item
   with no checkouts as 1 checked out, because the joined row is all
   NULL and NULL passes the `IS NULL` check. The report test caught it
   (an untouched item must show 0). Fixed by adding `c.id IS NOT NULL`
   to the check, and the test passes now.

**What I did myself:** the plan and the order of work, the decisions
in `DECISIONS.md` (including the retire semantics, decision 5), the
honest `PREVIOUS_WORK.md` note about DraftShot's starter
auth/leaderboard, and the final review of every endpoint against the
brief. The code was drafted by AI from my design; I directed it and
checked every line.

**The AI feature in this project:** the "Ask AI" tip box calls the
Gemini API (`gemini-3.8-flash`) from `backend/src/routes/ai.ts`. It is
a small extra I chose, kept apart from the Must items, and it is off
without a `GEMINI_API_KEY`. I decided what it should do, what it
should ask, and that it must fail clearly with 503 instead of breaking
anything.
