import { Router } from 'express';
import { query, withTx } from '../db';
import { badRequest, conflict, notFound } from '../errors';
import { requireAssistant } from '../middleware/auth';
import { createEquipmentSchema } from '../validation';

export const equipmentRouter = Router();

export interface EquipmentRow {
  id: number;
  name: string;
  total_units: number;
  retired: boolean;
  created_at: string;
  checked_out: number;
  available_units: number;
}

/**
 * GET /api/equipment — list with units currently available.
 * available = total - active checkouts. Computed in SQL (never a
 * stored counter, so it cannot drift out of sync with checkouts).
 */
equipmentRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await query<EquipmentRow>(
      `SELECT e.id, e.name, e.total_units, e.retired, e.created_at,
              COALESCE(COUNT(c.id), 0)::int AS checked_out,
              (e.total_units - COALESCE(COUNT(c.id), 0))::int AS available_units
         FROM equipment e
    LEFT JOIN checkouts c
           ON c.equipment_id = e.id AND c.returned_at IS NULL
        GROUP BY e.id
        ORDER BY e.name ASC`
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

/** POST /api/equipment — assistants only. Duplicate name (any case) → 409. */
equipmentRouter.post('/', requireAssistant, async (req, res, next) => {
  try {
    const parsed = createEquipmentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest(parsed.error.issues.map((i) => i.message).join('; '));
    }
    const { name, total_units } = parsed.data;
    try {
      const rows = await query<EquipmentRow>(
        `INSERT INTO equipment (name, total_units)
         VALUES ($1, $2)
         RETURNING id, name, total_units, retired, created_at, 0 AS checked_out, $2::int AS available_units`,
        [name, total_units]
      );
      res.status(201).json({ data: rows[0] });
    } catch (err: any) {
      if (err.code === '23505') throw conflict('An equipment item with that name already exists', 'DUPLICATE_NAME');
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/equipment/:id/retire — assistants only.
 * Retired items can no longer be borrowed, but existing checkouts
 * can still be returned. Idempotent: retiring twice is a no-op success.
 */
equipmentRouter.patch('/:id/retire', requireAssistant, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw badRequest('Invalid equipment id');
    const rows = await query<{ retired: boolean }>(
      'UPDATE equipment SET retired = TRUE WHERE id = $1 RETURNING retired',
      [id]
    );
    if (rows.length === 0) throw notFound('Equipment not found');
    res.json({ data: { id, retired: true } });
  } catch (err) {
    next(err);
  }
});

equipmentRouter.patch('/:id/unretire', requireAssistant, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw badRequest('Invalid equipment id');
    const rows = await query(
      'UPDATE equipment SET retired = FALSE WHERE id = $1 RETURNING id',
      [id]
    );
    if (rows.length === 0) throw notFound('Equipment not found');
    res.json({ data: { id, retired: false } });
  } catch (err) {
    next(err);
  }
});
