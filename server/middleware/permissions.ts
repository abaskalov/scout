import { createMiddleware } from 'hono/factory';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { pivotUsersProjects, type UserRole } from '../db/schema.js';
import { ForbiddenError } from '../lib/errors.js';

export function requireRole(...roles: UserRole[]) {
  return createMiddleware(async (c, next) => {
    const user = c.get('user');
    // Admin always has access
    if (user.role === 'admin') {
      await next();
      return;
    }
    if (!roles.includes(user.role as UserRole)) {
      throw new ForbiddenError(`Role '${user.role}' cannot access this resource`, 'FORBIDDEN');
    }
    await next();
  });
}

/**
 * Check if a user has access to a specific project via pivot_users_projects.
 * Admin always has access. Member/Agent must have a pivot entry.
 */
export function checkProjectAccess(userId: string, role: string, projectId: string): boolean {
  if (role === 'admin') return true;
  const access = db.select().from(pivotUsersProjects)
    .where(and(
      eq(pivotUsersProjects.userId, userId),
      eq(pivotUsersProjects.projectId, projectId),
    )).get();
  return !!access;
}
