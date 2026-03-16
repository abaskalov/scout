import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { HTTPException } from 'hono/http-exception';
import { authRoutes } from './routes/auth.js';
import { projectRoutes } from './routes/projects.js';
import { userRoutes } from './routes/users.js';
import { itemRoutes } from './routes/items.js';
import { sqlite } from './db/client.js';

const app = new Hono();

// CORS — allow widget origins (permissive in dev, validate in production)
app.use('/api/*', cors({
  origin: (origin) => {
    // In dev allow all origins
    if (process.env.NODE_ENV !== 'production') return origin;
    // In production: dynamic check against project allowed_origins would go here
    return origin;
  },
  allowMethods: ['POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// API routes
app.route('/api/auth', authRoutes);
app.route('/api/projects', projectRoutes);
app.route('/api/users', userRoutes);
app.route('/api/items', itemRoutes);

// Static files: screenshots, recordings
app.use('/storage/*', serveStatic({ root: './' }));

// Widget JS (built by Vite)
app.use('/widget/*', serveStatic({ root: './widget/dist/' }));

// Dashboard SPA (built by Vite, catch-all for client-side routing)
app.use('/*', serveStatic({ root: './dashboard/dist/' }));
app.get('/*', serveStatic({ root: './dashboard/dist/', path: 'index.html' }));

// Global error handler — no stack traces to client
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// Start server
const port = Number(process.env.SCOUT_PORT) || 10009;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Scout running on http://localhost:${info.port}`);
});

// Graceful shutdown
function shutdown() {
  console.log('Shutting down...');
  sqlite.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { app };
