import { Router } from 'express';
import { query, withTx } from '../db';
import { badRequest, conflict, forbidden, notFound } from '../errors';
import { canAccessCheckout } from '../middleware/auth';
import { borrowSchema, paginationSchema } from '../validation';

export const checkoutsRouter = Router();

export interface CheckoutRow {
  id: number;
  equipment_id: number;
  equipment_name: string;
  user_id: string;
  user_name: string;
  borrowed_at: string;
  due_at: string;
  returned_at: string | null;
  overdue: boolean;
}

const CHECKOUT_SELECT = `
  SELECT c.id, c.equipment_id, e.name AS equipment_name,
         c.user_id, u.name AS user_name,
         c.borrowed_at, c.due_at, c.returned_at,
         (c.returned_at IS NULL AND c.due_at < now()) AS overdue
    FROM checkouts c
    JOIN equipment e ON e.id = c.equipment_id
    JOIN users u ON u.id = c.user_id`;

/**
 * POST /api/checkouts — borrow one unit.
 * Concurrency (§8): whole check runs inside ONE transaction and the
 * equipment row is locked with SELECT ... FOR UPDATE, so two
 * simultaneous requests for the last unit serialise — exactly one
 * inserts, the other sees 0 available and gets 409 NOT_AVAILABLE.
 * Stock can never go below zero because the insert only happens
 * after the locked availability check.
 */
checkoutsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = borrowSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest(parsed.error.issues.map((i) => i.message).join('; '));
    const { equipment_id } = parsed.data;

    const created = await withTx(async (client) => {
      const eq = await client.query(
        'SELECT id, name, total_units, retired FROM equipment WHERE id = $1 FOR UPDATE',
        [equipment_id]
      );
      if (eq.rows.length === 0) throw notFound('Equipment not found');
      if (eq.rows[0].retired) throw conflict('This equipment has been retired', 'EQUIPMENT_RETIRED');

      const active = await client.query(
        'SELECT COUNT(*)::int AS n FROM checkouts WHERE equipment_id = $1 AND returned_at IS NULL',
        [equipment_id]
      );
      const available = eq.rows[0].total_units - active.rows[0].n;
      if (available <= 0) {
        throw conflict('No units available for this equipment', 'NOT_AVAILABLE');
      }

      const inserted = await client.query(
        `INSERT INTO checkouts (equipment_id, user_id, due_at)
         VALUES ($1, $2, now() + INTERVAL '7 days')
         RETURNING id, equipment_id, user_id, borrowed_at, due_at, returned_at`,
        [equipment_id, req.user!.id]
      );
      return inserted.rows[0];
    });

    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/checkouts — paginated, stable ordering.
 * Students see only their own; assistants see everyone's.
 * ORDER BY borrowed_at DESC, id DESC: the id tie-break keeps
 * pagination stable when two rows share a timestamp (§7).
 */
checkoutsRouter.get('/', async (req, res, next) => {
  try {
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) throw badRequest('Invalid pagination parameters');
    const { page, limit, status } = parsed.data;
    const offset = (page - 1) * limit;

    const where: string[] = [];
    const params: any[] = [];
    if (req.user!.role === 'student') {
      params.push(req.user!.id);
      where.push(`c.user_id = $${params.length}`);
    }
    if (status === 'active') where.push('c.returned_at IS NULL');
    if (status === 'returned') where.push('c.returned_at IS NOT NULL');
    if (status === 'overdue') where.push("c.returned_at IS NULL AND c.due_at < now()");
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalRows = await query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM checkouts c ${whereSql}`,
      params
    );
    const total = Number(totalRows[0].n);

    const rows = await query<CheckoutRow>(
      `${CHECKOUT_SELECT} ${whereSql}
        ORDER BY c.borrowed_at DESC, c.id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json({
      data: rows,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    next(err);
  }
});

function parseId(param: string): number {
  const id = Number(param);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid checkout id');
  return id;
}

/** GET /api/checkouts/:id — ownership enforced. */
checkoutsRouter.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const rows = await query<CheckoutRow>(`${CHECKOUT_SELECT} WHERE c.id = $1`, [id]);
    if (rows.length === 0) throw notFound('Checkout not found');
    if (!canAccessCheckout(req.user!, rows[0].user_id)) throw forbidden('You can only view your own checkouts');
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/checkouts/:id/return — return a unit.
 * Students return only their own; assistants return anyone's (§2).
 * Already-returned → 409. The checkout row is locked FOR UPDATE
 * so two simultaneous returns cannot double-return.
 */
checkoutsRouter.post('/:id/return', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const returned = await withTx(async (client) => {
      const found = await client.query(
        'SELECT id, user_id, returned_at FROM checkouts WHERE id = $1 FOR UPDATE',
        [id]
      );
      if (found.rows.length === 0) throw notFound('Checkout not found');
      const row = found.rows[0];
      if (!canAccessCheckout(req.user!, row.user_id)) {
        throw forbidden('You can only return your own checkouts');
      }
      if (row.returned_at) throw conflict('This checkout has already been returned', 'ALREADY_RETURNED');
      const updated = await client.query(
        `UPDATE checkouts SET returned_at = now() WHERE id = $1
         RETURNING id, equipment_id, user_id, borrowed_at, due_at, returned_at`,
        [id]
      );
      return updated.rows[0];
    });
    res.json({ data: returned });
  } catch (err) {
    next(err);
  }
});
