import { createMiddleware } from 'hono/factory';
import type { UserRole } from '../db/schema.js';
import { ForbiddenError } from '../lib/errors.js';

export function requireRole(...roles: UserRole[]) {
  return createMiddleware(async (c, next) => {
    const user = c.get('user');
    // Admin always has access
    if (user.role === 'admin') {
      await next();
      return;
    }
    if (!roles.includes(user.role as UserRole)) {
      throw new ForbiddenError(`Role '${user.role}' cannot access this resource`);
    }
    await next();
  });
}
