-- Lab Equipment Checkout — migration 001
-- Run: psql $DATABASE_URL -f db/migrations/001_init.sql
-- All timestamps are timestamptz (stored in UTC by Postgres).

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'assistant')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS equipment (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  total_units INTEGER NOT NULL CHECK (total_units >= 0),
  retired BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness on equipment name (brief §2).
-- lower(name) index, not a plain UNIQUE(name), so 'Oscilloscope'
-- and 'oscilloscope' collide. This is the index the brief asks
-- us to justify in DECISIONS.md.
CREATE UNIQUE INDEX IF NOT EXISTS equipment_name_lower_unique
  ON equipment (lower(name));

CREATE TABLE IF NOT EXISTS checkouts (
  id SERIAL PRIMARY KEY,
  equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  borrowed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at TIMESTAMPTZ NOT NULL,
  returned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (returned_at IS NULL OR returned_at >= borrowed_at),
  CHECK (due_at > borrowed_at)
);

-- Index 2: the hot path. Every availability / report / borrow
-- query counts active checkouts per equipment item.
CREATE INDEX IF NOT EXISTS checkouts_equipment_active_idx
  ON checkouts (equipment_id) WHERE returned_at IS NULL;

-- Index 3: "My checkouts" — list one student's checkouts, newest first.
-- (borrowed_at, id) also gives the stable tie-break for pagination (§7).
CREATE INDEX IF NOT EXISTS checkouts_user_borrowed_idx
  ON checkouts (user_id, borrowed_at DESC, id DESC);

-- Index 4: overdue scan for the report.
CREATE INDEX IF NOT EXISTS checkouts_overdue_idx
  ON checkouts (due_at) WHERE returned_at IS NULL;
