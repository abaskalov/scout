import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { HTTPException } from 'hono/http-exception';
import { readFileSync } from 'node:fs';
import { authRoutes } from './routes/auth.js';
import { projectRoutes } from './routes/projects.js';
import { userRoutes } from './routes/users.js';
import { itemRoutes } from './routes/items.js';
import { webhookRoutes } from './routes/webhooks.js';
import { apiKeyRoutes } from './routes/api-keys.js';
import { eventRoutes } from './routes/events.js';
import { docsRoutes } from './routes/docs.js';
import { sqlite } from './db/client.js';
import { securityHeaders } from './middleware/security-headers.js';
import { rateLimit } from './middleware/rate-limit.js';
import { authMiddleware } from './middleware/auth.js';
import { logger } from './lib/logger.js';

const app = new Hono();

// Security headers on ALL responses
app.use('*', securityHeaders);

// Structured request logging via pino
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  logger.info({
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration,
  }, 'request');
});

// Deep health check (for Docker, monitoring)
app.get('/health', (c) => {
  try {
    // Check DB connectivity
    const dbCheck = sqlite.prepare('SELECT 1 as ok').get() as { ok: number } | undefined;

    const mem = process.memoryUsage();

    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      db: dbCheck?.ok === 1 ? 'ok' : 'error',
      memory: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      },
    });
  } catch (err) {
    logger.error({ err }, 'Health check failed');
    return c.json({ status: 'error', error: String(err) }, 503);
  }
});

// --- CORS ---
const isProduction = process.env.NODE_ENV === 'production';
const corsOrigins = (process.env.SCOUT_CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use('/api/*', cors({
  origin: (origin) => {
    // Same-origin requests (no Origin header) — always allowed
    if (!origin) return origin;
    // In dev allow all origins
    if (!isProduction) return origin;
    // In production: check whitelist
    if (corsOrigins.includes(origin)) return origin;
    // Reject — return empty string to deny
    return '';
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// --- API version header ---
const apiVersionHeader = createMiddleware(async (c, next) => {
  await next();
  c.header('X-API-Version', 'v1');
});
app.use('/api/*', apiVersionHeader);

// --- SSE (registered before rate limiter — long-lived connections) ---
app.route('/api/events', eventRoutes);
app.route('/api/v1/events', eventRoutes);

// --- API Docs (public, no auth/rate-limit) ---
app.route('/api/docs', docsRoutes);

// --- Rate limiting ---
// Auth routes: 5 req/min per IP (brute-force protection)
app.use('/api/auth/*', rateLimit(60_000, 5));
app.use('/api/v1/auth/*', rateLimit(60_000, 5));
// Item creation: 20 req/min per IP
app.use('/api/items/create', rateLimit(60_000, 20));
app.use('/api/v1/items/create', rateLimit(60_000, 20));
// All API routes: 100 req/min per IP
app.use('/api/*', rateLimit(60_000, 100));

// V1 routes (current)
const v1 = new Hono();
v1.route('/auth', authRoutes);
v1.route('/projects', projectRoutes);
v1.route('/users', userRoutes);
v1.route('/items', itemRoutes);
v1.route('/webhooks', webhookRoutes);
v1.route('/api-keys', apiKeyRoutes);

// Mount v1 under /api/v1/
app.route('/api/v1', v1);

// Backward compatibility: /api/* → same as /api/v1/*
app.route('/api', v1);

// Static files: screenshots, recordings — require authentication
app.use('/storage/*', authMiddleware, serveStatic({ root: './' }));

// Widget JS (built by Vite)
app.use('/widget/*', serveStatic({
  root: './',
  rewriteRequestPath: (path) => path.replace('/widget/', '/widget/dist/'),
}));

// Demo stand
app.use('/demo/*', serveStatic({ root: './', rewriteRequestPath: (path) => path }));

// Dashboard SPA — try static file first, fallback to index.html for client-side routing
app.use('/*', serveStatic({ root: './dashboard/dist/' }));
app.get('/*', (c) => {
  try {
    const html = readFileSync('./dashboard/dist/index.html', 'utf-8');
    return c.html(html);
  } catch {
    return c.text('Dashboard not built. Run: pnpm build', 404);
  }
});

// Global error handler — no stack traces to client
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  logger.error({ err, method: c.req.method, path: c.req.path }, 'Unhandled request error');
  return c.json({ error: 'Internal server error' }, 500);
});

// Start server
const port = Number(process.env.SCOUT_PORT) || 10009;

serve({ fetch: app.fetch, port }, (info) => {
  logger.info({ port: info.port }, 'Scout started');
});

// Graceful shutdown
function shutdown() {
  logger.info('Shutting down');
  sqlite.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { app };
