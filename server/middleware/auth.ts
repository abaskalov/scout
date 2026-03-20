import { createMiddleware } from 'hono/factory';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '../db/client.js';
import { users, apiKeys, type User } from '../db/schema.js';
import { verifyToken } from '../services/auth.js';
import { UnauthorizedError } from '../lib/errors.js';

// Extend Hono context with user
declare module 'hono' {
  interface ContextVariableMap {
    user: User;
  }
}

/**
 * Extract Bearer token from Authorization header or ?token= query param.
 * Header takes priority. Returns null if neither is present.
 */
function extractToken(c: { req: { header: (n: string) => string | undefined; query: (n: string) => string | undefined } }): string | null {
  const header = c.req.header('Authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return c.req.query('token') ?? null;
}

/**
 * Storage auth — accepts both Authorization header and ?token= query param.
 * Needed because <img src> and plain fetch() can't send Authorization headers.
 */
export const storageAuth = createMiddleware(async (c, next) => {
  const token = extractToken(c);
  if (!token) throw new UnauthorizedError('Missing authentication');

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }

  const user = db.select().from(users).where(eq(users.id, payload.userId)).get();
  if (!user || !user.isActive) throw new UnauthorizedError('User not found or inactive');

  c.set('user', user);
  await next();
});

export const authMiddleware = createMiddleware(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }

  const token = header.slice(7);

  // Check for API key auth: Bearer sk_live_...
  if (token.startsWith('sk_live_')) {
    const prefix = token.slice(0, 16);
    const apiKey = db.select().from(apiKeys)
      .where(and(
        eq(apiKeys.keyPrefix, prefix),
        eq(apiKeys.isActive, true),
      )).get();

    if (!apiKey) {
      throw new UnauthorizedError('Неверный API-ключ');
    }

    // Verify full key via bcrypt
    const valid = await bcrypt.compare(token, apiKey.keyHash);
    if (!valid) {
      throw new UnauthorizedError('Неверный API-ключ');
    }

    // Check expiry
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      throw new UnauthorizedError('API-ключ истёк');
    }

    // Load user
    const user = db.select().from(users).where(eq(users.id, apiKey.userId)).get();
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Пользователь деактивирован');
    }

    // Update last used (fire-and-forget, don't block response)
    db.update(apiKeys).set({ lastUsedAt: new Date().toISOString() }).where(eq(apiKeys.id, apiKey.id)).run();

    c.set('user', user);
    await next();
    return;
  }

  // JWT auth
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
