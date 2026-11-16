import { Router } from 'express';
import { pool } from '../db';
import { badRequest, conflict, forbidden, notFound } from '../errors';
import { canAccessCheckout } from '../middleware/auth';
import { borrowSchema, paginationSchema } from '../validation';

export const checkoutsRouter = Router();

const checkoutSelect = `
  SELECT c.id, c.equipment_id, e.name AS equipment_name,
         c.user_id, u.name AS user_name,
         c.borrowed_at, c.due_at, c.returned_at,
         (c.returned_at IS NULL AND c.due_at < now()) AS overdue
    FROM checkouts c
    JOIN equipment e ON e.id = c.equipment_id
    JOIN users u ON u.id = c.user_id`;

function parseId(param: string) {
  const id = Number(param);
  if (!Number.isInteger(id) || id <= 0) {
    throw badRequest('Invalid checkout id');
  }
  return id;
}

checkoutsRouter.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const parsed = borrowSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues.map((i) => i.message).join('; '));
    }
    const equipment_id = parsed.data.equipment_id;

    await client.query('BEGIN');
    const found = await client.query(
      'SELECT id, name, total_units, retired FROM equipment WHERE id = $1 FOR UPDATE',
      [equipment_id]
    );
    if (found.rows.length === 0) {
      throw notFound('Equipment not found');
    }
    if (found.rows[0].retired) {
      throw conflict('This equipment has been retired', 'EQUIPMENT_RETIRED');
    }
    const active = await client.query(
      'SELECT COUNT(*)::int AS n FROM checkouts WHERE equipment_id = $1 AND returned_at IS NULL',
      [equipment_id]
    );
    const available = found.rows[0].total_units - active.rows[0].n;
    if (available <= 0) {
      throw conflict('No units available for this equipment', 'NOT_AVAILABLE');
    }
    const inserted = await client.query(
      `INSERT INTO checkouts (equipment_id, user_id, due_at)
       VALUES ($1, $2, now() + INTERVAL '7 days')
       RETURNING id, equipment_id, user_id, borrowed_at, due_at, returned_at`,
      [equipment_id, (req as any).user.id]
    );
    await client.query('COMMIT');
    res.status(201).json({ data: inserted.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

checkoutsRouter.get('/', async (req, res, next) => {
  try {
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) {
      throw badRequest('Invalid pagination parameters');
    }
    const page = parsed.data.page;
    const limit = parsed.data.limit;
    const status = parsed.data.status;
    const offset = (page - 1) * limit;

    const where: string[] = [];
    const params: any[] = [];
    if ((req as any).user.role === 'student') {
      params.push((req as any).user.id);
      where.push('c.user_id = $' + params.length);
    }
    if (status === 'active') {
      where.push('c.returned_at IS NULL');
    }
    if (status === 'returned') {
      where.push('c.returned_at IS NOT NULL');
    }
    if (status === 'overdue') {
      where.push('c.returned_at IS NULL AND c.due_at < now()');
    }
    let whereSql = '';
    if (where.length > 0) {
      whereSql = 'WHERE ' + where.join(' AND ');
    }

    const totalResult = await pool.query(
      'SELECT COUNT(*)::text AS n FROM checkouts c ' + whereSql,
      params
    );
    const total = Number(totalResult.rows[0].n);
    const rowsResult = await pool.query(
      checkoutSelect + ' ' + whereSql + ' ORDER BY c.borrowed_at DESC, c.id DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2),
      [...params, limit, offset]
    );
    res.json({
      data: rowsResult.rows,
      pagination: { page: page, limit: limit, total: total, total_pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    next(err);
  }
});

checkoutsRouter.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const result = await pool.query(checkoutSelect + ' WHERE c.id = $1', [id]);
    if (result.rows.length === 0) {
      throw notFound('Checkout not found');
    }
    if (!canAccessCheckout((req as any).user, result.rows[0].user_id)) {
      throw forbidden('You can only view your own checkouts');
    }
    res.json({ data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

checkoutsRouter.post('/:id/return', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const id = parseId(req.params.id);
    await client.query('BEGIN');
    const found = await client.query(
      'SELECT id, user_id, returned_at FROM checkouts WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (found.rows.length === 0) {
      throw notFound('Checkout not found');
    }
    const row = found.rows[0];
    if (!canAccessCheckout((req as any).user, row.user_id)) {
      throw forbidden('You can only return your own checkouts');
    }
    if (row.returned_at) {
      throw conflict('This checkout has already been returned', 'ALREADY_RETURNED');
    }
    const updated = await client.query(
      `UPDATE checkouts SET returned_at = now() WHERE id = $1
       RETURNING id, equipment_id, user_id, borrowed_at, due_at, returned_at`,
      [id]
    );
    await client.query('COMMIT');
    res.json({ data: updated.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});
