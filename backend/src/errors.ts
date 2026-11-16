export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function badRequest(message: string) {
  return new ApiError(400, 'VALIDATION_ERROR', message);
}

export function unauthorized(message: string) {
  return new ApiError(401, 'UNAUTHORIZED', message);
}

export function forbidden(message: string) {
  return new ApiError(403, 'FORBIDDEN', message);
}

export function notFound(message: string) {
  return new ApiError(404, 'NOT_FOUND', message);
}

export function conflict(message: string, code: string) {
  return new ApiError(409, code, message);
}
