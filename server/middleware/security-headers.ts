import { createMiddleware } from 'hono/factory';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Sets security headers on all responses.
 * In production, also enables HSTS.
 */
export const securityHeaders = createMiddleware(async (c, next) => {
  await next();

  c.header('X-Content-Type-Options', 'nosniff');
  // SSO bridge must be frameable — it's designed to be iframed for cross-domain auth
  if (c.req.path !== '/auth/sso') {
    c.header('X-Frame-Options', 'DENY');
  }
  c.header('X-XSS-Protection', '0');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (isProduction) {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
});
