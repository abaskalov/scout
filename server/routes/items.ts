import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../db/client.js';
import { scoutItems, scoutItemNotes, projects } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/permissions.js';
import { randomUUID } from 'node:crypto';
import { NotFoundError } from '../lib/errors.js';
import {
  createItemSchema, listItemsSchema, getItemSchema,
  countItemsSchema, claimItemSchema, resolveItemSchema,
  cancelItemSchema, updateItemStatusSchema, addNoteSchema,
} from '../lib/schemas.js';
import { createItem, claimItem, updateItemStatus } from '../services/items.js';

export const itemRoutes = new Hono()
  .use('/*', authMiddleware)

  // CREATE — member, admin
  .post('/create',
    requireRole('member', 'admin'),
    zValidator('json', createItemSchema),
    async (c) => {
      const data = c.req.valid('json');
      const user = c.get('user');

      // Verify project exists
      const project = db.select().from(projects).where(eq(projects.id, data.projectId)).get();
      if (!project) throw new NotFoundError('Project');

      const item = createItem({ ...data, reporterId: user.id });
      return c.json({ data: item }, 201);
    })

  // LIST — all roles
  .post('/list',
    zValidator('json', listItemsSchema),
    async (c) => {
      const { projectId, status, assigneeId, page, perPage } = c.req.valid('json');

      const conditions = [eq(scoutItems.projectId, projectId)];
      if (status) conditions.push(eq(scoutItems.status, status));
      if (assigneeId) conditions.push(eq(scoutItems.assigneeId, assigneeId));

      const where = conditions.length === 1 ? conditions[0]! : and(...conditions);

      const items = db.select().from(scoutItems)
        .where(where)
        .orderBy(desc(scoutItems.createdAt))
        .limit(perPage)
        .offset((page - 1) * perPage)
        .all();

      const [{ total }] = db.select({ total: count() }).from(scoutItems).where(where).all();

      return c.json({
        data: {
          items,
          pagination: {
            page,
            perPage,
            total,
            totalPages: Math.ceil(total / perPage),
          },
        },
      });
    })

  // GET — all roles (item + notes)
  .post('/get',
    zValidator('json', getItemSchema),
    async (c) => {
      const { id } = c.req.valid('json');
      const item = db.select().from(scoutItems).where(eq(scoutItems.id, id)).get();
      if (!item) throw new NotFoundError('Item');

      const notes = db.select().from(scoutItemNotes)
        .where(eq(scoutItemNotes.itemId, id))
        .orderBy(scoutItemNotes.createdAt)
        .all();

      return c.json({ data: { ...item, notes } });
    })

  // COUNT — all roles
  .post('/count',
    zValidator('json', countItemsSchema),
    async (c) => {
      const { projectId } = c.req.valid('json');
      const statuses = ['new', 'in_progress', 'review', 'done', 'cancelled'] as const;
      const counts: Record<string, number> = {};

      for (const status of statuses) {
        const [{ total }] = db.select({ total: count() }).from(scoutItems)
          .where(and(eq(scoutItems.projectId, projectId), eq(scoutItems.status, status)))
          .all();
        counts[status] = total;
      }

      return c.json({ data: { counts } });
    })

  // CLAIM — agent, admin
  .post('/claim',
    requireRole('agent', 'admin'),
    zValidator('json', claimItemSchema),
    async (c) => {
      const { id } = c.req.valid('json');
      const item = claimItem(id, c.get('user'));
      return c.json({ data: item });
    })

  // RESOLVE — agent, admin
  .post('/resolve',
    requireRole('agent', 'admin'),
    zValidator('json', resolveItemSchema),
    async (c) => {
      const { id, resolutionNote, branchName, mrUrl } = c.req.valid('json');
      // resolve transitions to 'done' via in_progress → done
      // If item is in_progress, this is valid
      const item = updateItemStatus(id, 'done', c.get('user'), {
        resolutionNote, branchName, mrUrl,
      });
      return c.json({ data: item });
    })

  // CANCEL — admin only
  .post('/cancel',
    requireRole('admin'),
    zValidator('json', cancelItemSchema),
    async (c) => {
      const { id } = c.req.valid('json');
      const item = updateItemStatus(id, 'cancelled', c.get('user'));
      return c.json({ data: item });
    })

  // UPDATE STATUS — agent, admin (generic)
  .post('/update-status',
    requireRole('agent', 'admin'),
    zValidator('json', updateItemStatusSchema),
    async (c) => {
      const { id, status, branchName, mrUrl, attemptCount } = c.req.valid('json');
      const item = updateItemStatus(id, status, c.get('user'), {
        branchName, mrUrl, attemptCount,
      });
      return c.json({ data: item });
    })

  // ADD NOTE — all roles
  .post('/add-note',
    zValidator('json', addNoteSchema),
    async (c) => {
      const { itemId, content } = c.req.valid('json');
      const user = c.get('user');

      // Verify item exists
      const item = db.select().from(scoutItems).where(eq(scoutItems.id, itemId)).get();
      if (!item) throw new NotFoundError('Item');

      const id = randomUUID();
      db.insert(scoutItemNotes).values({
        id, itemId, userId: user.id, content, type: 'comment',
      }).run();

      const note = db.select().from(scoutItemNotes).where(eq(scoutItemNotes.id, id)).get()!;
      return c.json({ data: note }, 201);
    });
