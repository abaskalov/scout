import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '../db/client.js';
import { apiKeys, projects } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/permissions.js';
import { randomUUID, randomBytes } from 'node:crypto';
import { NotFoundError } from '../lib/errors.js';
import { createApiKeySchema, listApiKeysSchema, revokeApiKeySchema } from '../lib/schemas.js';
import { logAudit, getClientIp } from '../services/audit.js';

export const apiKeyRoutes = new Hono()
  .use('/*', authMiddleware)
  .use('/*', requireRole('admin'))

  // CREATE — generates key, returns ONCE
  .post('/create',
    zValidator('json', createApiKeySchema),
    async (c) => {
      const { projectId, name, expiresAt } = c.req.valid('json');

      // Verify project exists
      const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
      if (!project) throw new NotFoundError('Project', 'PROJECT_NOT_FOUND');

      const user = c.get('user');
      const id = randomUUID();

      // Generate key: sk_live_ + 32 random hex chars
      const rawKey = `sk_live_${randomBytes(16).toString('hex')}`;
      const keyPrefix = rawKey.slice(0, 16);
      const keyHash = await bcrypt.hash(rawKey, 10);

      db.insert(apiKeys).values({
        id,
        projectId,
        userId: user.id,
        name,
        keyHash,
        keyPrefix,
        expiresAt: expiresAt ?? null,
      }).run();

      logAudit({
        userId: user.id,
        action: 'create_api_key',
        entityType: 'api_key',
        entityId: id,
        details: { projectId, name },
        ipAddress: getClientIp(c),
      });

      return c.json({
        data: {
          key: rawKey, // Only time the full key is visible
          id,
          name,
          keyPrefix,
          projectId,
          expiresAt: expiresAt ?? null,
        },
      }, 201);
    })

  // LIST — shows prefix, name, lastUsed (NOT full key)
  .post('/list',
    zValidator('json', listApiKeysSchema),
    async (c) => {
      const { projectId } = c.req.valid('json');

      const keys = db.select({
        id: apiKeys.id,
        projectId: apiKeys.projectId,
        userId: apiKeys.userId,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        isActive: apiKeys.isActive,
        createdAt: apiKeys.createdAt,
      }).from(apiKeys)
        .where(eq(apiKeys.projectId, projectId))
        .all();

      return c.json({ data: { items: keys } });
    })

  // REVOKE — deactivate a key
  .post('/revoke',
    zValidator('json', revokeApiKeySchema),
    async (c) => {
      const { id } = c.req.valid('json');

      const existing = db.select().from(apiKeys).where(eq(apiKeys.id, id)).get();
      if (!existing) throw new NotFoundError('API Key', 'API_KEY_NOT_FOUND');

      db.update(apiKeys)
        .set({ isActive: false })
        .where(eq(apiKeys.id, id))
        .run();

      const user = c.get('user');
      logAudit({
        userId: user.id,
        action: 'revoke_api_key',
        entityType: 'api_key',
        entityId: id,
        details: { name: existing.name },
        ipAddress: getClientIp(c),
      });

      return c.json({ data: { success: true } });
    });
