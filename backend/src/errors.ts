/** Consistent error body for every endpoint: { error: { code, message } } */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

export const badRequest = (message: string, code = 'VALIDATION_ERROR') =>
  new ApiError(400, code, message);
export const unauthorized = (message = 'Missing or unknown X-User-Id header') =>
  new ApiError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You are not allowed to do that') =>
  new ApiError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Not found') => new ApiError(404, 'NOT_FOUND', message);
export const conflict = (message: string, code = 'CONFLICT') =>
  new ApiError(409, code, message);
