import { db } from '../db/client.js';
import { auditLog } from '../db/schema.js';
import { randomUUID } from 'node:crypto';
import { logger } from '../lib/logger.js';

export function logAudit(data: {
  userId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}): void {
  try {
    db.insert(auditLog).values({
      id: randomUUID(),
      userId: data.userId,
      action: data.action,
      entityType: data.entityType ?? null,
      entityId: data.entityId ?? null,
      details: data.details ? JSON.stringify(data.details) : null,
      ipAddress: data.ipAddress ?? null,
    }).run();
  } catch {
    // Audit logging should never break the main flow
    logger.error({ action: data.action }, 'Audit log write failed');
  }
}

export function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
}
