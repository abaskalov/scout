import { createMiddleware } from 'hono/factory';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users, type User } from '../db/schema.js';
import { verifyToken } from '../services/auth.js';
import { UnauthorizedError } from '../lib/errors.js';

// Extend Hono context with user
declare module 'hono' {
  interface ContextVariableMap {
    user: User;
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }

  const token = header.slice(7);

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }

  const user = db.select().from(users).where(eq(users.id, payload.userId)).get();
  if (!user || !user.isActive) {
    throw new UnauthorizedError('User not found or inactive');
  }

  c.set('user', user);
  await next();
});
