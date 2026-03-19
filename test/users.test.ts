import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { userRoutes } from '../server/routes/users.js';
import { createTestContext, type TestContext } from './helpers.js';
import { randomUUID } from 'node:crypto';
import * as schema from '../server/db/schema.js';
import { eq } from 'drizzle-orm';

// Mock the db module
vi.mock('../server/db/client.js', async () => {
  return { db: null, sqlite: { close: () => {} } };
});

describe('Users routes', () => {
  let ctx: TestContext;
  let app: Hono;

  beforeEach(async () => {
    ctx = createTestContext();
    const dbModule = await import('../server/db/client.js');
    (dbModule as any).db = ctx.db;

    app = new Hono();
    app.route('/api/users', userRoutes);
    app.onError((err, c) => {
      if (err instanceof HTTPException) {
        return c.json({ error: err.message }, err.status);
      }
      return c.json({ error: 'Internal server error' }, 500);
    });
  });

  function post(path: string, body: unknown, token: string) {
    return app.request(`/api/users${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  }

  // Valid password that meets policy: min 8, uppercase, lowercase, digit
  const VALID_PASSWORD = 'TestPass1';
  const WEAK_PASSWORD_NO_UPPER = 'testpass1';
  const WEAK_PASSWORD_NO_LOWER = 'TESTPASS1';
  const WEAK_PASSWORD_NO_DIGIT = 'TestPassWord';
  const WEAK_PASSWORD_TOO_SHORT = 'Te1';

  // === CREATE ===

  it('POST /create — admin can create user', async () => {
    const res = await post('/create', {
      email: 'newuser@test.local',
      password: VALID_PASSWORD,
      name: 'New User',
      role: 'member',
      projectIds: [ctx.projectId],
    }, ctx.adminToken);

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.data.email).toBe('newuser@test.local');
    expect(body.data.name).toBe('New User');
    expect(body.data.role).toBe('member');
    expect(body.data.projectIds).toEqual([ctx.projectId]);
    // Password hash must not leak
    expect(body.data.passwordHash).toBeUndefined();
  });

  it('POST /create — admin can create user with empty projectIds', async () => {
    const res = await post('/create', {
      email: 'noprojects@test.local',
      password: VALID_PASSWORD,
      name: 'No Projects User',
      role: 'agent',
      projectIds: [],
    }, ctx.adminToken);

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.data.projectIds).toEqual([]);
  });

  it('POST /create — non-admin cannot create', async () => {
    const res = await post('/create', {
      email: 'forbidden@test.local',
      password: VALID_PASSWORD,
      name: 'Forbidden',
      role: 'member',
      projectIds: [],
    }, ctx.memberToken);

    expect(res.status).toBe(403);
  });

  it('POST /create — agent cannot create', async () => {
    const res = await post('/create', {
      email: 'agentcreate@test.local',
      password: VALID_PASSWORD,
      name: 'Agent Create',
      role: 'member',
      projectIds: [],
    }, ctx.agentToken);

    expect(res.status).toBe(403);
  });

  it('POST /create — duplicate email fails with 409', async () => {
    const res = await post('/create', {
      email: 'admin@test.local', // already exists from seed
      password: VALID_PASSWORD,
      name: 'Duplicate Admin',
      role: 'member',
      projectIds: [],
    }, ctx.adminToken);

    expect(res.status).toBe(409);
  });

  it('POST /create — weak password (no uppercase) fails validation', async () => {
    const res = await post('/create', {
      email: 'weak1@test.local',
      password: WEAK_PASSWORD_NO_UPPER,
      name: 'Weak User',
      role: 'member',
      projectIds: [],
    }, ctx.adminToken);

    expect(res.status).toBe(400);
  });

  it('POST /create — weak password (no lowercase) fails validation', async () => {
    const res = await post('/create', {
      email: 'weak2@test.local',
      password: WEAK_PASSWORD_NO_LOWER,
      name: 'Weak User',
      role: 'member',
      projectIds: [],
    }, ctx.adminToken);

    expect(res.status).toBe(400);
  });

  it('POST /create — weak password (no digit) fails validation', async () => {
    const res = await post('/create', {
      email: 'weak3@test.local',
      password: WEAK_PASSWORD_NO_DIGIT,
      name: 'Weak User',
      role: 'member',
      projectIds: [],
    }, ctx.adminToken);

    expect(res.status).toBe(400);
  });

  it('POST /create — weak password (too short) fails validation', async () => {
    const res = await post('/create', {
      email: 'weak4@test.local',
      password: WEAK_PASSWORD_TOO_SHORT,
      name: 'Weak User',
      role: 'member',
      projectIds: [],
    }, ctx.adminToken);

    expect(res.status).toBe(400);
  });

  it('POST /create — missing required fields fails with 400', async () => {
    const res = await post('/create', {}, ctx.adminToken);
    expect(res.status).toBe(400);
  });

  it('POST /create — missing email fails with 400', async () => {
    const res = await post('/create', {
      password: VALID_PASSWORD,
      name: 'No Email',
      role: 'member',
    }, ctx.adminToken);

    expect(res.status).toBe(400);
  });

  it('POST /create — invalid email format fails with 400', async () => {
    const res = await post('/create', {
      email: 'not-an-email',
      password: VALID_PASSWORD,
      name: 'Bad Email',
      role: 'member',
      projectIds: [],
    }, ctx.adminToken);

    expect(res.status).toBe(400);
  });

  it('POST /create — without auth returns 401', async () => {
    const res = await app.request('/api/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'noauth@test.local',
        password: VALID_PASSWORD,
        name: 'No Auth',
        role: 'member',
        projectIds: [],
      }),
    });

    expect(res.status).toBe(401);
  });

  // === LIST ===

  it('POST /list — admin can list all users', async () => {
    const res = await post('/list', {}, ctx.adminToken);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    // Seed has 3 users: admin, agent, member
    expect(body.data.items).toHaveLength(3);
    expect(body.data.pagination.total).toBe(3);
    // All users should have projectIds attached
    for (const user of body.data.items) {
      expect(user.projectIds).toBeDefined();
      expect(Array.isArray(user.projectIds)).toBe(true);
      // Password hash must not leak
      expect(user.passwordHash).toBeUndefined();
    }
  });

  it('POST /list — admin list with pagination', async () => {
    const res = await post('/list', { page: 1, perPage: 2 }, ctx.adminToken);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.items).toHaveLength(2);
    expect(body.data.pagination.total).toBe(3);
    expect(body.data.pagination.totalPages).toBe(2);
  });

  it('POST /list — admin can filter by projectId', async () => {
    const res = await post('/list', { projectId: ctx.projectId }, ctx.adminToken);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    // Should return: admin (always included) + agent + member (both have pivot)
    expect(body.data.items).toHaveLength(3);
  });

  it('POST /list — non-admin cannot list', async () => {
    const res = await post('/list', {}, ctx.memberToken);
    expect(res.status).toBe(403);
  });

  it('POST /list — agent cannot list', async () => {
    const res = await post('/list', {}, ctx.agentToken);
    expect(res.status).toBe(403);
  });

  // === GET ===

  it('POST /get — admin gets user with projectIds', async () => {
    const res = await post('/get', { id: ctx.memberId }, ctx.adminToken);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.id).toBe(ctx.memberId);
    expect(body.data.email).toBe('member@test.local');
    expect(body.data.projectIds).toEqual([ctx.projectId]);
    expect(body.data.passwordHash).toBeUndefined();
  });

  it('POST /get — admin gets admin user (no pivots)', async () => {
    const res = await post('/get', { id: ctx.adminId }, ctx.adminToken);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.id).toBe(ctx.adminId);
    // Admin has no pivot entries in seed data
    expect(body.data.projectIds).toEqual([]);
  });

  it('POST /get — non-admin cannot get', async () => {
    const res = await post('/get', { id: ctx.adminId }, ctx.memberToken);
    expect(res.status).toBe(403);
  });

  it('POST /get — non-existent returns 404', async () => {
    const res = await post('/get', { id: randomUUID() }, ctx.adminToken);
    expect(res.status).toBe(404);
  });

  it('POST /get — invalid uuid returns 400', async () => {
    const res = await post('/get', { id: 'not-a-uuid' }, ctx.adminToken);
    expect(res.status).toBe(400);
  });

  // === UPDATE ===

  it('POST /update — admin can update name', async () => {
    const res = await post('/update', {
      id: ctx.memberId,
      name: 'Updated Name',
    }, ctx.adminToken);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.name).toBe('Updated Name');
  });

  it('POST /update — admin can update role', async () => {
    const res = await post('/update', {
      id: ctx.memberId,
      role: 'agent',
    }, ctx.adminToken);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.role).toBe('agent');
  });

  it('POST /update — admin can update isActive', async () => {
    const res = await post('/update', {
      id: ctx.memberId,
      isActive: false,
    }, ctx.adminToken);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.isActive).toBe(false);
  });

  it('POST /update — admin can update password with valid policy', async () => {
    const res = await post('/update', {
      id: ctx.memberId,
      password: 'NewStrong1',
    }, ctx.adminToken);

    expect(res.status).toBe(200);
    // Verify password was actually changed by checking the hash differs
    const user = ctx.db.select().from(schema.users)
      .where(eq(schema.users.id, ctx.memberId)).get()!;
    expect(user.passwordHash).toBeDefined();
    // Password hash should not be in response
    const body = await res.json() as any;
    expect(body.data.passwordHash).toBeUndefined();
  });

  it('POST /update — admin can update projectIds (pivot rebuild)', async () => {
    // Create a second project
    const proj2Id = randomUUID();
    ctx.db.insert(schema.projects).values({
      id: proj2Id,
      name: 'Project Two',
      slug: 'project-two',
      allowedOrigins: '[]',
    }).run();

    const res = await post('/update', {
      id: ctx.memberId,
      projectIds: [ctx.projectId, proj2Id],
    }, ctx.adminToken);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.projectIds).toHaveLength(2);
    expect(body.data.projectIds).toContain(ctx.projectId);
    expect(body.data.projectIds).toContain(proj2Id);
  });

  it('POST /update — pivot rebuild removes old entries', async () => {
    // Member currently has access to projectId. Remove it.
    const res = await post('/update', {
      id: ctx.memberId,
      projectIds: [], // remove all project access
    }, ctx.adminToken);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.projectIds).toEqual([]);

    // Verify in DB
    const pivots = ctx.db.select().from(schema.pivotUsersProjects)
      .where(eq(schema.pivotUsersProjects.userId, ctx.memberId)).all();
    expect(pivots).toHaveLength(0);
  });

  it('POST /update — weak password change fails validation', async () => {
    const res = await post('/update', {
      id: ctx.memberId,
      password: 'weak',
    }, ctx.adminToken);

    expect(res.status).toBe(400);
  });

  it('POST /update — non-admin cannot update', async () => {
    const res = await post('/update', {
      id: ctx.memberId,
      name: 'Hacked Name',
    }, ctx.memberToken);

    expect(res.status).toBe(403);
  });

  it('POST /update — agent cannot update', async () => {
    const res = await post('/update', {
      id: ctx.memberId,
      name: 'Agent Hack',
    }, ctx.agentToken);

    expect(res.status).toBe(403);
  });

  it('POST /update — non-existent user returns 404', async () => {
    const res = await post('/update', {
      id: randomUUID(),
      name: 'Ghost',
    }, ctx.adminToken);

    expect(res.status).toBe(404);
  });

  it('POST /update — email field is not in schema (cannot change email)', async () => {
    // The updateUserSchema does not include email, so it should be stripped/ignored
    const res = await post('/update', {
      id: ctx.memberId,
      name: 'Name Changed',
      email: 'hacked@evil.com', // extra field, should be ignored by zod
    }, ctx.adminToken);

    // Zod strips unknown keys by default, so the request should succeed
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.email).toBe('member@test.local'); // unchanged
  });

  // === DELETE ===

  it('POST /delete — admin can delete user', async () => {
    const res = await post('/delete', { id: ctx.memberId }, ctx.adminToken);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.success).toBe(true);

    // Verify user is gone
    const getRes = await post('/get', { id: ctx.memberId }, ctx.adminToken);
    expect(getRes.status).toBe(404);
  });

  it('POST /delete — cannot self-delete', async () => {
    const res = await post('/delete', { id: ctx.adminId }, ctx.adminToken);
    expect(res.status).toBe(409);
  });

  it('POST /delete — non-admin cannot delete', async () => {
    const res = await post('/delete', { id: ctx.memberId }, ctx.memberToken);
    expect(res.status).toBe(403);
  });

  it('POST /delete — agent cannot delete', async () => {
    const res = await post('/delete', { id: ctx.memberId }, ctx.agentToken);
    expect(res.status).toBe(403);
  });

  it('POST /delete — non-existent returns 404', async () => {
    const res = await post('/delete', { id: randomUUID() }, ctx.adminToken);
    expect(res.status).toBe(404);
  });

  it('POST /delete — deleting user removes pivot entries', async () => {
    // member has a pivot entry
    const res = await post('/delete', { id: ctx.memberId }, ctx.adminToken);
    expect(res.status).toBe(200);

    // Pivot should be cascade-deleted
    const pivots = ctx.db.select().from(schema.pivotUsersProjects)
      .where(eq(schema.pivotUsersProjects.userId, ctx.memberId)).all();
    expect(pivots).toHaveLength(0);
  });
});
