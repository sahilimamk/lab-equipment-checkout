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

CREATE INDEX IF NOT EXISTS checkouts_equipment_active_idx
  ON checkouts (equipment_id) WHERE returned_at IS NULL;

CREATE INDEX IF NOT EXISTS checkouts_user_borrowed_idx
  ON checkouts (user_id, borrowed_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS checkouts_overdue_idx
  ON checkouts (due_at) WHERE returned_at IS NULL;
