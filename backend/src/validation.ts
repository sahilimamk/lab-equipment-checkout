import { z } from 'zod';

export const createEquipmentSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  total_units: z
    .number({ invalid_type_error: 'total_units must be a number' })
    .int('total_units must be a whole number')
    .min(1, 'total_units must be at least 1')
    .max(1000)
});

export const borrowSchema = z.object({
  equipment_id: z.number().int().positive('equipment_id must be a positive integer')
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'overdue', 'returned', 'all']).default('all')
});
