import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, count, desc, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users, pivotUsersProjects } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/permissions.js';
import { hashPassword } from '../services/auth.js';
import { randomUUID } from 'node:crypto';
import { NotFoundError, ConflictError } from '../lib/errors.js';
import {
  createUserSchema, updateUserSchema,
  getUserSchema, deleteUserSchema, listUsersSchema,
} from '../lib/schemas.js';

function stripPassword(user: typeof users.$inferSelect) {
  const { passwordHash: _, ...rest } = user;
  return rest;
}

export const userRoutes = new Hono()
  .use('/*', authMiddleware)
  .use('/*', requireRole('admin'))

  // CREATE
  .post('/create',
    zValidator('json', createUserSchema),
    async (c) => {
      const { email, password, name, role, projectIds } = c.req.valid('json');

      // Check unique email
      const existing = db.select().from(users).where(eq(users.email, email)).get();
      if (existing) throw new ConflictError(`User with email '${email}' already exists`);

      const id = randomUUID();
      const passwordHash = await hashPassword(password);

      db.insert(users).values({ id, email, passwordHash, name, role }).run();

      // Create pivot entries
      for (const projectId of projectIds) {
        db.insert(pivotUsersProjects).values({ userId: id, projectId }).run();
      }

      const user = db.select().from(users).where(eq(users.id, id)).get()!;
      const pivots = db.select().from(pivotUsersProjects)
        .where(eq(pivotUsersProjects.userId, id)).all();

      return c.json({
        data: { ...stripPassword(user), projectIds: pivots.map((p) => p.projectId) },
      }, 201);
    })

  // LIST
  .post('/list',
    zValidator('json', listUsersSchema),
    async (c) => {
      const { projectId, page, perPage } = c.req.valid('json');

      let userList;
      let total: number;

      if (projectId) {
        // Get users linked to this project (+ all admins)
        const pivotUserIds = db.select({ userId: pivotUsersProjects.userId })
          .from(pivotUsersProjects)
          .where(eq(pivotUsersProjects.projectId, projectId))
          .all()
          .map((p) => p.userId);

        // Also include admins (they have access to all projects)
        const allUsers = db.select().from(users)
          .orderBy(desc(users.createdAt))
          .all();

        const filtered = allUsers.filter(
          (u) => u.role === 'admin' || pivotUserIds.includes(u.id),
        );
        total = filtered.length;
        userList = filtered.slice((page - 1) * perPage, page * perPage);
      } else {
        userList = db.select().from(users)
          .orderBy(desc(users.createdAt))
          .limit(perPage)
          .offset((page - 1) * perPage)
          .all();
        const [{ cnt }] = db.select({ cnt: count() }).from(users).all();
        total = cnt;
      }

      // Attach projectIds to each user
      const userIds = userList.map((u) => u.id);
      const pivots = userIds.length
        ? db.select().from(pivotUsersProjects)
            .where(inArray(pivotUsersProjects.userId, userIds))
            .all()
        : [];
      const pivotMap = new Map<string, string[]>();
      for (const p of pivots) {
        const arr = pivotMap.get(p.userId);
        if (arr) arr.push(p.projectId);
        else pivotMap.set(p.userId, [p.projectId]);
      }

      return c.json({
        data: {
          items: userList.map((u) => ({
            ...stripPassword(u),
            projectIds: pivotMap.get(u.id) ?? [],
          })),
          pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
        },
      });
    })

  // GET
  .post('/get',
    zValidator('json', getUserSchema),
    async (c) => {
      const { id } = c.req.valid('json');
      const user = db.select().from(users).where(eq(users.id, id)).get();
      if (!user) throw new NotFoundError('User');

      const pivots = db.select().from(pivotUsersProjects)
        .where(eq(pivotUsersProjects.userId, id)).all();

      return c.json({
        data: { ...stripPassword(user), projectIds: pivots.map((p) => p.projectId) },
      });
    })

  // UPDATE
  .post('/update',
    zValidator('json', updateUserSchema),
    async (c) => {
      const { id, name, role, isActive, projectIds, password } = c.req.valid('json');

      const existing = db.select().from(users).where(eq(users.id, id)).get();
      if (!existing) throw new NotFoundError('User');

      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      if (name !== undefined) updateData.name = name;
      if (role !== undefined) updateData.role = role;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (password !== undefined) updateData.passwordHash = await hashPassword(password);

      db.update(users).set(updateData).where(eq(users.id, id)).run();

      // Rebuild pivot if projectIds provided
      if (projectIds !== undefined) {
        db.delete(pivotUsersProjects).where(eq(pivotUsersProjects.userId, id)).run();
        for (const projectId of projectIds) {
          db.insert(pivotUsersProjects).values({ userId: id, projectId }).run();
        }
      }

      const user = db.select().from(users).where(eq(users.id, id)).get()!;
      const pivots = db.select().from(pivotUsersProjects)
        .where(eq(pivotUsersProjects.userId, id)).all();

      return c.json({
        data: { ...stripPassword(user), projectIds: pivots.map((p) => p.projectId) },
      });
    })

  // DELETE
  .post('/delete',
    zValidator('json', deleteUserSchema),
    async (c) => {
      const { id } = c.req.valid('json');

      const existing = db.select().from(users).where(eq(users.id, id)).get();
      if (!existing) throw new NotFoundError('User');

      // Prevent deleting yourself
      const currentUser = c.get('user');
      if (currentUser.id === id) {
        throw new ConflictError('Cannot delete yourself');
      }

      db.delete(users).where(eq(users.id, id)).run();
      return c.json({ data: { success: true } });
    });
