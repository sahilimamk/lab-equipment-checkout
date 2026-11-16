import { NextFunction, Request, Response } from 'express';
import { pool } from '../db';
import { forbidden, unauthorized } from '../errors';

export async function requireUser(req: any, _res: Response, next: NextFunction) {
  const userId = req.header('X-User-Id');
  if (!userId) {
    return next(unauthorized('Missing or unknown X-User-Id header'));
  }
  const result = await pool.query('SELECT id, name, role FROM users WHERE id = $1', [userId]);
  if (result.rows.length === 0) {
    return next(unauthorized('Unknown X-User-Id header'));
  }
  req.user = result.rows[0];
  next();
}

export function requireAssistant(req: any, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(unauthorized('Missing or unknown X-User-Id header'));
  }
  if (req.user.role !== 'assistant') {
    return next(forbidden('Only lab assistants can do that'));
  }
  next();
}

export function canAccessCheckout(user: any, checkoutUserId: string) {
  if (user.role === 'assistant') {
    return true;
  }
  return user.id === checkoutUserId;
}
