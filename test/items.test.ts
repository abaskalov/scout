import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { itemRoutes } from '../server/routes/items.js';
import { createTestContext, type TestContext } from './helpers.js';
import { randomUUID } from 'node:crypto';

// Mock the db module
vi.mock('../server/db/client.js', async () => {
  return { db: null, sqlite: { close: () => {} } };
});

describe('Items routes', () => {
  let ctx: TestContext;
  let app: Hono;

  beforeEach(async () => {
    ctx = createTestContext();
    const dbModule = await import('../server/db/client.js');
    (dbModule as any).db = ctx.db;

    app = new Hono();
    app.route('/api/items', itemRoutes);
  });

  function post(path: string, body: unknown, token: string) {
    return app.request(`/api/items${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  }

  async function createTestItem(token?: string) {
    const res = await post('/create', {
      projectId: ctx.projectId,
      message: 'Test bug report',
      pageUrl: 'http://localhost:3000/page',
      cssSelector: '.btn-submit',
    }, token || ctx.adminToken);
    const body = await res.json() as any;
    return body.data;
  }

  // === CREATE ===

  it('POST /create — admin can create item', async () => {
    const res = await post('/create', {
      projectId: ctx.projectId,
      message: 'Button broken on mobile',
    }, ctx.adminToken);

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.data.status).toBe('new');
    expect(body.data.reporterId).toBe(ctx.adminId);
  });

  it('POST /create — member can create item', async () => {
    const res = await post('/create', {
      projectId: ctx.projectId,
      message: 'Another bug report',
    }, ctx.memberToken);

    expect(res.status).toBe(201);
  });

  it('POST /create — agent cannot create item', async () => {
    const res = await post('/create', {
      projectId: ctx.projectId,
      message: 'Agent should not create',
    }, ctx.agentToken);

    expect(res.status).toBe(403);
  });

  it('POST /create — without auth returns 401', async () => {
    const res = await app.request('/api/items/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: ctx.projectId, message: 'No auth' }),
    });

    expect(res.status).toBe(401);
  });

  // === LIST ===

  it('POST /list — returns items with pagination', async () => {
    await createTestItem();
    await createTestItem();

    const res = await post('/list', { projectId: ctx.projectId }, ctx.adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.items).toHaveLength(2);
    expect(body.data.pagination.total).toBe(2);
  });

  it('POST /list — filter by status', async () => {
    await createTestItem();

    const res = await post('/list', {
      projectId: ctx.projectId,
      status: 'in_progress',
    }, ctx.adminToken);

    const body = await res.json() as any;
    expect(body.data.items).toHaveLength(0);
  });

  // === GET ===

  it('POST /get — returns item with notes', async () => {
    const item = await createTestItem();

    const res = await post('/get', { id: item.id }, ctx.adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.id).toBe(item.id);
    expect(body.data.notes).toBeDefined();
    expect(Array.isArray(body.data.notes)).toBe(true);
  });

  it('POST /get — non-existent returns 404', async () => {
    const res = await post('/get', { id: randomUUID() }, ctx.adminToken);
    expect(res.status).toBe(404);
  });

  // === COUNT ===

  it('POST /count — returns counts by status', async () => {
    await createTestItem();
    await createTestItem();

    const res = await post('/count', { projectId: ctx.projectId }, ctx.adminToken);
    const body = await res.json() as any;
    expect(body.data.counts.new).toBe(2);
    expect(body.data.counts.in_progress).toBe(0);
  });

  // === CLAIM ===

  it('POST /claim — agent claims new item', async () => {
    const item = await createTestItem();

    const res = await post('/claim', { id: item.id }, ctx.agentToken);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.status).toBe('in_progress');
    expect(body.data.assigneeId).toBe(ctx.agentId);
  });

  it('POST /claim — double claim fails with 409', async () => {
    const item = await createTestItem();

    await post('/claim', { id: item.id }, ctx.agentToken);
    const res = await post('/claim', { id: item.id }, ctx.agentToken);
    expect(res.status).toBe(409);
  });

  it('POST /claim — member cannot claim', async () => {
    const item = await createTestItem();
    const res = await post('/claim', { id: item.id }, ctx.memberToken);
    expect(res.status).toBe(403);
  });

  // === RESOLVE ===

  it('POST /resolve — from in_progress to done', async () => {
    const item = await createTestItem();
    await post('/claim', { id: item.id }, ctx.agentToken);

    const res = await post('/resolve', {
      id: item.id,
      resolutionNote: 'Fixed the button handler',
      branchName: 'fix/scout-123',
    }, ctx.agentToken);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.status).toBe('done');
    expect(body.data.resolvedAt).toBeDefined();
    expect(body.data.resolutionNote).toBe('Fixed the button handler');
  });

  it('POST /resolve — from new fails (invalid transition)', async () => {
    const item = await createTestItem();
    const res = await post('/resolve', { id: item.id }, ctx.agentToken);
    expect(res.status).toBe(400);
  });

  // === CANCEL ===

  it('POST /cancel — admin cancels new item', async () => {
    const item = await createTestItem();
    const res = await post('/cancel', { id: item.id }, ctx.adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.status).toBe('cancelled');
  });

  it('POST /cancel — cannot cancel done item', async () => {
    const item = await createTestItem();
    await post('/claim', { id: item.id }, ctx.agentToken);
    await post('/resolve', { id: item.id }, ctx.agentToken);

    const res = await post('/cancel', { id: item.id }, ctx.adminToken);
    expect(res.status).toBe(400);
  });

  // === ADD NOTE ===

  it('POST /add-note — any role can add note', async () => {
    const item = await createTestItem();

    const res = await post('/add-note', {
      itemId: item.id,
      content: 'This is a manual comment',
    }, ctx.memberToken);

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.data.content).toBe('This is a manual comment');
    expect(body.data.type).toBe('comment');
  });

  // === AUTO-NOTES ===

  it('claim + resolve creates auto-notes', async () => {
    const item = await createTestItem();
    await post('/claim', { id: item.id }, ctx.agentToken);
    await post('/resolve', { id: item.id }, ctx.agentToken);

    const res = await post('/get', { id: item.id }, ctx.adminToken);
    const body = await res.json() as any;
    const notes = body.data.notes;

    // Expect: claim(assignment) + claim(status_change) + resolve(status_change) = 3 auto-notes
    expect(notes.length).toBeGreaterThanOrEqual(3);
    const types = notes.map((n: any) => n.type);
    expect(types).toContain('assignment');
    expect(types).toContain('status_change');
  });
});
