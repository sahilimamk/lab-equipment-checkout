import { NextFunction, Request, Response } from 'express';
import { query } from '../db';
import { forbidden, unauthorized } from '../errors';

export type Role = 'student' | 'assistant';
export interface AuthUser {
  id: string;
  name: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Brief §2: no sign-up / login. The API trusts the X-User-Id header,
 * but it must still resolve to a real seeded user — an unknown id is 401,
 * and every rule below is still enforced server-side.
 */
export async function requireUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const userId = req.header('X-User-Id');
    if (!userId) throw unauthorized();
    const rows = await query<AuthUser>('SELECT id, name, role FROM users WHERE id = $1', [userId]);
    if (rows.length === 0) throw unauthorized('Unknown X-User-Id header');
    req.user = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAssistant(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  if (req.user.role !== 'assistant') {
    return next(forbidden('Only lab assistants can do that'));
  }
  next();
}

/** Ownership rule (§2/§3.3): students touch only their own checkouts. */
export function canAccessCheckout(user: AuthUser, checkoutUserId: string): boolean {
  return user.role === 'assistant' || user.id === checkoutUserId;
}
