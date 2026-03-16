import { HTTPException } from 'hono/http-exception';

export class UnauthorizedError extends HTTPException {
  constructor(message = 'Unauthorized') {
    super(401, { message });
  }
}

export class ForbiddenError extends HTTPException {
  constructor(message = 'Forbidden') {
    super(403, { message });
  }
}

export class NotFoundError extends HTTPException {
  constructor(resource = 'Resource') {
    super(404, { message: `${resource} not found` });
  }
}

export class ValidationError extends HTTPException {
  constructor(message = 'Validation failed') {
    super(400, { message });
  }
}

export class ConflictError extends HTTPException {
  constructor(message = 'Conflict') {
    super(409, { message });
  }
}
