import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { webhookRoutes } from '../server/routes/webhooks.js';
import { createTestContext, type TestContext } from './helpers.js';
import { randomUUID } from 'node:crypto';

// Mock the db module
vi.mock('../server/db/client.js', async () => {
  return { db: null, sqlite: { close: () => {} } };
});

describe('Webhooks routes', () => {
  let ctx: TestContext;
  let app: Hono;

  beforeEach(async () => {
    ctx = createTestContext();
    const dbModule = await import('../server/db/client.js');
    (dbModule as any).db = ctx.db;

    app = new Hono();
    app.route('/api/webhooks', webhookRoutes);
  });

  function post(path: string, body: unknown, token: string) {
    return app.request(`/api/webhooks${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  }

  async function createTestWebhook(token?: string) {
    const res = await post('/create', {
      projectId: ctx.projectId,
      url: 'https://example.com/webhook',
      secret: 'test-secret',
      events: ['item.created', 'item.status_changed'],
    }, token || ctx.adminToken);
    const body = await res.json() as any;
    return body.data;
  }

  // === CREATE ===

  it('POST /create — admin can create webhook', async () => {
    const res = await post('/create', {
      projectId: ctx.projectId,
      url: 'https://example.com/webhook',
      secret: 'my-secret',
      events: ['item.created', 'item.status_changed'],
    }, ctx.adminToken);

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.data.url).toBe('https://example.com/webhook');
    expect(body.data.secret).toBe('my-secret');
    expect(body.data.isActive).toBe(true);
    expect(JSON.parse(body.data.events)).toEqual(['item.created', 'item.status_changed']);
  });

  it('POST /create — without secret is ok', async () => {
    const res = await post('/create', {
      projectId: ctx.projectId,
      url: 'https://example.com/webhook',
      events: ['item.created'],
    }, ctx.adminToken);

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.data.secret).toBeNull();
  });

  it('POST /create — non-admin cannot create webhook', async () => {
    const res = await post('/create', {
      projectId: ctx.projectId,
      url: 'https://example.com/webhook',
      events: ['item.created'],
    }, ctx.memberToken);

    expect(res.status).toBe(403);
  });

  it('POST /create — agent cannot create webhook', async () => {
    const res = await post('/create', {
      projectId: ctx.projectId,
      url: 'https://example.com/webhook',
      events: ['item.created'],
    }, ctx.agentToken);

    expect(res.status).toBe(403);
  });

  it('POST /create — invalid project returns 404', async () => {
    const res = await post('/create', {
      projectId: randomUUID(),
      url: 'https://example.com/webhook',
      events: ['item.created'],
    }, ctx.adminToken);

    expect(res.status).toBe(404);
  });

  it('POST /create — invalid URL fails validation', async () => {
    const res = await post('/create', {
      projectId: ctx.projectId,
      url: 'not-a-url',
      events: ['item.created'],
    }, ctx.adminToken);

    expect(res.status).toBe(400);
  });

  it('POST /create — empty events fails validation', async () => {
    const res = await post('/create', {
      projectId: ctx.projectId,
      url: 'https://example.com/webhook',
      events: [],
    }, ctx.adminToken);

    expect(res.status).toBe(400);
  });

  it('POST /create — invalid event type fails validation', async () => {
    const res = await post('/create', {
      projectId: ctx.projectId,
      url: 'https://example.com/webhook',
      events: ['item.created', 'invalid.event'],
    }, ctx.adminToken);

    expect(res.status).toBe(400);
  });

  // === LIST ===

  it('POST /list — returns webhooks for project', async () => {
    await createTestWebhook();
    await createTestWebhook();

    const res = await post('/list', { projectId: ctx.projectId }, ctx.adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.items).toHaveLength(2);
  });

  it('POST /list — empty project returns empty array', async () => {
    const res = await post('/list', { projectId: ctx.projectId }, ctx.adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.items).toHaveLength(0);
  });

  it('POST /list — non-admin cannot list webhooks', async () => {
    const res = await post('/list', { projectId: ctx.projectId }, ctx.memberToken);
    expect(res.status).toBe(403);
  });

  // === UPDATE ===

  it('POST /update — admin can update webhook URL', async () => {
    const webhook = await createTestWebhook();

    const res = await post('/update', {
      id: webhook.id,
      url: 'https://new-url.com/hook',
    }, ctx.adminToken);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.url).toBe('https://new-url.com/hook');
  });

  it('POST /update — can disable webhook', async () => {
    const webhook = await createTestWebhook();

    const res = await post('/update', {
      id: webhook.id,
      isActive: false,
    }, ctx.adminToken);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.isActive).toBe(false);
  });

  it('POST /update — can update events', async () => {
    const webhook = await createTestWebhook();

    const res = await post('/update', {
      id: webhook.id,
      events: ['item.deleted', 'item.commented'],
    }, ctx.adminToken);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(JSON.parse(body.data.events)).toEqual(['item.deleted', 'item.commented']);
  });

  it('POST /update — non-existent webhook returns 404', async () => {
    const res = await post('/update', {
      id: randomUUID(),
      url: 'https://new-url.com/hook',
    }, ctx.adminToken);

    expect(res.status).toBe(404);
  });

  // === DELETE ===

  it('POST /delete — admin can delete webhook', async () => {
    const webhook = await createTestWebhook();

    const res = await post('/delete', { id: webhook.id }, ctx.adminToken);
    expect(res.status).toBe(200);

    // Verify it's gone
    const listRes = await post('/list', { projectId: ctx.projectId }, ctx.adminToken);
    const listBody = await listRes.json() as any;
    expect(listBody.data.items).toHaveLength(0);
  });

  it('POST /delete — non-existent webhook returns 404', async () => {
    const res = await post('/delete', { id: randomUUID() }, ctx.adminToken);
    expect(res.status).toBe(404);
  });

  it('POST /delete — non-admin cannot delete', async () => {
    const webhook = await createTestWebhook();
    const res = await post('/delete', { id: webhook.id }, ctx.agentToken);
    expect(res.status).toBe(403);
  });

  // === Without auth ===

  it('all routes require authentication', async () => {
    const res = await app.request('/api/webhooks/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: ctx.projectId }),
    });
    expect(res.status).toBe(401);
  });
});
