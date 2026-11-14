# Decisions

## 1. Availability is computed, never stored

**Decision:** `available_units = total_units − COUNT(active checkouts)`,
computed in SQL on every read. No `available_units` column.

**Alternatives:** a stored counter updated on borrow/return, or a
`stock` column decremented in place.

**Why:** a stored counter can drift (a failed return, a manual fix, a
crashed request) and then every later answer is wrong. The count query
is cheap at this scale, is always consistent with the checkout rows,
and makes "stock can never go below zero" a property of the check, not
of a number we hope stayed in sync.

## 2. Concurrency: lock the equipment row, check, then insert — in one transaction

**Decision:** borrow runs `SELECT … FROM equipment WHERE id = $1 FOR UPDATE`,
counts active checkouts, and only then inserts — all inside one
transaction. Two simultaneous requests for the last unit serialise;
exactly one gets 201, the other 409 `NOT_AVAILABLE`.

**Alternatives:** `UPDATE equipment SET stock = stock - 1 WHERE stock > 0`
(atomic decrement), or optimistic checks in application code.

**Why:** the row lock is the most explicit form of the rule and it
works with the computed-availability model from decision 1 (there is
no counter to decrement). Application-only checks without a lock would
race. The concurrency test in `tests/concurrency.test.ts` proves the
behaviour. Trade-off: a hot item serialises borrowers briefly — fine
for a lab with a handful of concurrent borrows.

## 3. Case-insensitive uniqueness via `lower(name)` index, not `citext`

**Decision:** `CREATE UNIQUE INDEX … ON equipment (lower(name))`,
plus the same check surfaced as a 409 `DUPLICATE_NAME`.

**Alternatives:** `citext` extension, or a plain `UNIQUE(name)` and a
case-insensitive check in code.

**Why:** `citext` needs an extension the reviewer may not have enabled;
a plain unique constraint would let `Oscilloscope` and `oscilloscope`
co-exist. The expression index enforces the rule in the database, so
no code path can bypass it. The same index is the one "justified
index" the brief asks for (the other indexes are justified in the
migration comments: active-checkout counts, per-user lists, overdue
scans).

## 4. Seeded users + `X-User-Id` header, no auth system

**Decision:** follow the brief exactly — five seeded users, header
identification, no passwords, no JWT, no sign-up.

**Alternatives:** build a small login/JWT flow anyway, or add a
password column "for completeness".

**Why:** the brief says not to build sign-up/login, and inventing auth
would add an untested security surface to a 5–6 hour exercise. The
header is still validated (unknown id → 401) and every rule is
enforced server-side, so a forged header for another *student* still
cannot see or return that student's checkouts — only an assistant's
id can, which is the intended role boundary.

## 5. A situation the brief does not spell out: what "retire" means for existing checkouts

**Decision:** retiring an item blocks *new* borrows (409
`EQUIPMENT_RETIRED`) but does **not** cancel or force-return checkouts
already out, and does not hide the item from lists (it shows a
"Retired" badge). Returns of retired items still work.

**Alternatives:** delete the item, hide it entirely, or auto-return
its active checkouts.

**Why:** deleting would break the foreign key / history, hiding it
would confuse a student who still holds one, and auto-returning would
falsely record equipment as back in the lab when it is not. The chosen
meaning is the least surprising: the lab stops lending it, nothing
already lent is pretended away.

**Notes on other brief-silent behaviour:** assistants are allowed to
borrow (the brief never forbids it — they are also lab users), and
there is no per-student cap on units of the same item (the only limit
is total stock). Both follow from "the brief does not forbid it, so do
not invent a restriction". Creating equipment through the API needs
`total_units >= 1` even though the schema allows 0 — a zero-stock item
can exist in the seed data, but the form should not create one.
