import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../errors';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Request body is not valid JSON' } });
  }
  if (err && err.code === '22P02') {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid id in URL' } });
  }
  if (err && err.code === '23505') {
    return res.status(409).json({ error: { code: 'DUPLICATE_NAME', message: 'An equipment item with that name already exists' } });
  }
  console.error(err);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on the server' } });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
}
