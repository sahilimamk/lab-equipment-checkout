# AI usage

**Tool used:** Muse (Meta's personal AI assistant), in a single build
session on 14 November 2026, to scaffold and write this project from
the brief — backend structure, SQL, API routes, React screens, tests,
Docker Compose, CI workflow, and these docs. I reviewed the generated
code, ran the tests, and fixed what the test runs surfaced.

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
   a separate test tsconfig; the build and all 19 tests were re-run
   after the fix.

**What I wrote entirely myself:** the decisions in `DECISIONS.md`
(including the retire semantics, decision 5), the honest
`PREVIOUS_WORK.md` note about DraftShot's starter auth/leaderboard,
and the final review of every endpoint against the brief's rules
(stock never below zero, ownership, 7-day due date, case-insensitive
names). The ideas and the verification are mine; the AI did the
typing-heavy drafting.

**Rewrite on 16 November 2026:** after the first draft I rewrote the
code in a plain beginner style, in my own words, with no comments in
the code files, so I can explain every line in the follow-up without
AI. The rewrite kept the same API, the same database tables and the
same 19 tests. It removed the helper that hid the transaction
(`withTx`), the generic `query<T>` helper, and the `FILTER` aggregate
in the report. Borrow and return now show BEGIN, COMMIT and ROLLBACK
in the route itself, and the report uses a plain `SUM(CASE WHEN ...)`.
