import { createMiddleware } from 'hono/factory';
import type { Context, MiddlewareHandler } from 'hono';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

// Periodic cleanup of expired entries (every 60s)
setInterval(() => {
  const now = Date.now();
  for (const store of stores.values()) {
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }
}, 60_000).unref();

/**
 * In-memory rate limiter middleware.
 * @param windowMs - Time window in milliseconds
 * @param max - Max requests allowed within the window
 */
export function rateLimit(windowMs: number, max: number): MiddlewareHandler {
  const storeKey = `${windowMs}:${max}:${Math.random()}`;
  const store = new Map<string, RateLimitEntry>();
  stores.set(storeKey, store);

  return createMiddleware(async (c, next) => {
    const key = getClientIp(c);
    const now = Date.now();

    let entry = store.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    // Set rate limit headers
    const remaining = Math.max(0, max - entry.count);
    c.header('X-RateLimit-Limit', String(max));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      c.header('Retry-After', String(retryAfter));
      return c.json(
        { error: 'Слишком много запросов. Попробуйте позже.' },
        429,
      );
    }

    await next();
  });
}

/** Extract client IP from common proxy headers or socket */
function getClientIp(c: Context): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    || c.req.header('x-real-ip')
    || '127.0.0.1'
  );
}
