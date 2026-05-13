import { createMiddleware } from 'hono/factory';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { pivotUsersProjects, type ProjectRole, type UserRole } from '../db/schema.js';
import { ForbiddenError } from '../lib/errors.js';

export type ProjectPermission =
  | 'view'
  | 'create_item'
  | 'comment'
  | 'workflow'
  | 'triage'
  | 'manage_project'
  | 'manage_members'
  | 'manage_integrations';

const PROJECT_ROLE_PERMISSIONS: Record<ProjectRole, ProjectPermission[]> = {
  owner: ['view', 'create_item', 'comment', 'workflow', 'triage', 'manage_project', 'manage_members', 'manage_integrations'],
  manager: ['view', 'create_item', 'comment', 'workflow', 'triage'],
  developer: ['view', 'comment', 'workflow'],
  reporter: ['view', 'create_item', 'comment'],
  viewer: ['view'],
};

export function defaultProjectRoleForUserRole(role: string): ProjectRole {
  if (role === 'agent') return 'developer';
  return 'reporter';
}

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
  return getProjectRole(userId, role, projectId) !== null;
}

export function getProjectRole(userId: string, role: string, projectId: string): ProjectRole | null {
  if (role === 'admin') return 'owner';
  const access = db.select().from(pivotUsersProjects)
    .where(and(
      eq(pivotUsersProjects.userId, userId),
      eq(pivotUsersProjects.projectId, projectId),
    )).get();
  return access?.role ?? null;
}

export function hasProjectPermission(userId: string, role: string, projectId: string, permission: ProjectPermission): boolean {
  if (role === 'admin') return true;
  const projectRole = getProjectRole(userId, role, projectId);
  if (!projectRole) return false;
  return PROJECT_ROLE_PERMISSIONS[projectRole].includes(permission);
}

export function requireProjectPermission(userId: string, role: string, projectId: string, permission: ProjectPermission): void {
  if (!hasProjectPermission(userId, role, projectId, permission)) {
    throw new ForbiddenError('Нет прав для этого действия в проекте', 'NO_PROJECT_PERMISSION');
  }
}
