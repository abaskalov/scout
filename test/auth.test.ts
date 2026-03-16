import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { authRoutes } from '../server/routes/auth.js';
import { createTestContext, type TestContext } from './helpers.js';

// Mock the db module to use test DB
vi.mock('../server/db/client.js', async () => {
  // This will be overridden in beforeEach
  return { db: null, sqlite: { close: () => {} } };
});

describe('Auth routes', () => {
  let ctx: TestContext;
  let app: Hono;

  beforeEach(async () => {
    ctx = createTestContext();

    // Override the mocked db
    const dbModule = await import('../server/db/client.js');
    (dbModule as any).db = ctx.db;

    app = new Hono();
    app.route('/api/auth', authRoutes);
  });

  it('POST /api/auth/login — success', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.local', password: 'password' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.token).toBeDefined();
    expect(body.data.user.email).toBe('admin@test.local');
    expect(body.data.user.role).toBe('admin');
    // Password hash must not be in response
    expect(body.data.user.passwordHash).toBeUndefined();
  });

  it('POST /api/auth/login — wrong password', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@test.local', password: 'wrong' }),
    });

    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login — non-existent email', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@test.local', password: 'password' }),
    });

    expect(res.status).toBe(401);
  });

  it('POST /api/auth/me — with valid token', async () => {
    const res = await app.request('/api/auth/me', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.adminToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.user.id).toBe(ctx.adminId);
    expect(body.data.user.passwordHash).toBeUndefined();
  });

  it('POST /api/auth/me — without token', async () => {
    const res = await app.request('/api/auth/me', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/me — with invalid token', async () => {
    const res = await app.request('/api/auth/me', {
      method: 'POST',
      headers: { Authorization: 'Bearer invalid-token' },
    });
    expect(res.status).toBe(401);
  });
});
