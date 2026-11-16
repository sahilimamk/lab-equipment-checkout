import { Router } from 'express';
import { pool } from '../db';

export const reportRouter = Router();

reportRouter.get('/equipment-usage', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT e.id AS equipment_id, e.name, e.total_units,
              SUM(CASE WHEN c.id IS NOT NULL AND c.returned_at IS NULL THEN 1 ELSE 0 END)::int AS checked_out,
              SUM(CASE WHEN c.id IS NOT NULL AND c.returned_at IS NULL AND c.due_at < now() THEN 1 ELSE 0 END)::int AS overdue,
              (e.total_units - SUM(CASE WHEN c.id IS NOT NULL AND c.returned_at IS NULL THEN 1 ELSE 0 END))::int AS available_units
         FROM equipment e
    LEFT JOIN checkouts c ON c.equipment_id = e.id
        GROUP BY e.id, e.name, e.total_units
        ORDER BY e.name ASC`
    );
    res.json({ data: result.rows });
  } catch (err) {
    next(err);
  }
});
