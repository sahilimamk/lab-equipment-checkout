import { Router } from 'express';
import { query } from '../db';

export const reportRouter = Router();

export interface ReportRow {
  equipment_id: number;
  name: string;
  total_units: number;
  checked_out: number;
  overdue: number;
  available_units: number;
}

/**
 * GET /api/report/equipment-usage (§4).
 * One SQL query: LEFT JOIN + aggregates. Items with zero checkouts
 * still appear (checked_out 0) because of the LEFT JOIN.
 * overdue = active checkout whose due_at has passed.
 */
reportRouter.get('/equipment-usage', async (_req, res, next) => {
  try {
    const rows = await query<ReportRow>(
      `SELECT e.id AS equipment_id, e.name, e.total_units,
              COUNT(c.id) FILTER (WHERE c.returned_at IS NULL)::int AS checked_out,
              COUNT(c.id) FILTER (WHERE c.returned_at IS NULL AND c.due_at < now())::int AS overdue,
              (e.total_units - COUNT(c.id) FILTER (WHERE c.returned_at IS NULL))::int AS available_units
         FROM equipment e
    LEFT JOIN checkouts c ON c.equipment_id = e.id
        GROUP BY e.id, e.name, e.total_units
        ORDER BY e.name ASC`
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});
