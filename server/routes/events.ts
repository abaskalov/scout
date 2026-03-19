import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { eventBus } from '../lib/event-bus.js';
import { verifyToken } from '../services/auth.js';
import { checkProjectAccess } from '../middleware/permissions.js';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export const eventRoutes = new Hono()

  // GET /api/events/stream?token=xxx&projectId=yyy
  .get('/stream', (c) => {
    // Auth: token as query param (EventSource doesn't support headers)
    const token = c.req.query('token');
    if (!token) {
      return c.json({ error: 'Token required' }, 401);
    }

    // Validate JWT
    let payload: { userId: string; role: string };
    try {
      payload = verifyToken(token);
    } catch {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    // Verify user exists and is active
    const user = db.select().from(users).where(eq(users.id, payload.userId)).get();
    if (!user || !user.isActive) {
      return c.json({ error: 'User not found or inactive' }, 401);
    }

    const projectId = c.req.query('projectId') || null;

    return streamSSE(c, async (stream) => {
      // Send heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        stream.writeSSE({ data: '', event: 'heartbeat', id: String(Date.now()) })
          .catch(() => clearInterval(heartbeat));
      }, 30_000);

      // Subscribe to events
      const unsubscribe = eventBus.subscribe((event) => {
        // Filter by projectId if specified
        if (projectId && event.projectId !== projectId) return;

        // Check project access for this user
        if (!checkProjectAccess(user.id, user.role, event.projectId)) return;

        stream.writeSSE({
          data: JSON.stringify(event.payload),
          event: event.type,
          id: String(Date.now()),
        }).catch(() => {
          // Client disconnected — cleanup will happen via onAbort
        });
      });

      // Cleanup on client disconnect
      stream.onAbort(() => {
        clearInterval(heartbeat);
        unsubscribe();
      });

      // Keep the stream open — never resolves
      await new Promise<void>(() => {});
    });
  });
