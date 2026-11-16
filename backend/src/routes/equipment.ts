import { Router } from 'express';
import { pool } from '../db';
import { badRequest, conflict, notFound } from '../errors';
import { requireAssistant } from '../middleware/auth';
import { createEquipmentSchema } from '../validation';

export const equipmentRouter = Router();

equipmentRouter.get('/', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT e.id, e.name, e.total_units, e.retired, e.created_at,
              COALESCE(COUNT(c.id), 0)::int AS checked_out,
              (e.total_units - COALESCE(COUNT(c.id), 0))::int AS available_units
         FROM equipment e
    LEFT JOIN checkouts c
           ON c.equipment_id = e.id AND c.returned_at IS NULL
        GROUP BY e.id
        ORDER BY e.name ASC`
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});

equipmentRouter.post('/', requireAssistant, async (req, res, next) => {
  try {
    const parsed = createEquipmentSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join('; ');
      throw badRequest(message);
    }
    const name = parsed.data.name;
    const total_units = parsed.data.total_units;
    try {
      const result = await pool.query(
        `INSERT INTO equipment (name, total_units)
         VALUES ($1, $2)
         RETURNING id, name, total_units, retired, created_at, 0 AS checked_out, $2::int AS available_units`,
        [name, total_units]
      );
      res.status(201).json({ data: result.rows[0] });
    } catch (err: any) {
      if (err.code === '23505') {
        throw conflict('An equipment item with that name already exists', 'DUPLICATE_NAME');
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

equipmentRouter.patch('/:id/retire', requireAssistant, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      throw badRequest('Invalid equipment id');
    }
    const result = await pool.query(
      'UPDATE equipment SET retired = TRUE WHERE id = $1 RETURNING retired',
      [id]
    );
    if (result.rows.length === 0) {
      throw notFound('Equipment not found');
    }
    res.json({ data: { id: id, retired: true } });
  } catch (err) {
    next(err);
  }
});
