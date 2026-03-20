import { HTTPException } from 'hono/http-exception';

export class UnauthorizedError extends HTTPException {
  code: string;
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(401, { message });
    this.code = code;
  }
}

export class ForbiddenError extends HTTPException {
  code: string;
  constructor(message = 'Forbidden', code = 'FORBIDDEN') {
    super(403, { message });
    this.code = code;
  }
}

export class NotFoundError extends HTTPException {
  code: string;
  constructor(resource = 'Resource', code = 'NOT_FOUND') {
    super(404, { message: `${resource} not found` });
    this.code = code;
  }
}

export class ValidationError extends HTTPException {
  code: string;
  constructor(message = 'Validation failed', code = 'VALIDATION_FAILED') {
    super(400, { message });
    this.code = code;
  }
}

export class ConflictError extends HTTPException {
  code: string;
  constructor(message = 'Conflict', code = 'CONFLICT') {
    super(409, { message });
    this.code = code;
  }
}
