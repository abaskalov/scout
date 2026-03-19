import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// === Projects ===
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  allowedOrigins: text('allowed_origins').notNull().default('[]'), // JSON array
  autofixEnabled: integer('autofix_enabled', { mode: 'boolean' }).notNull().default(true),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// === Users ===
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role', { enum: ['admin', 'member', 'agent'] }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// === Pivot: Users <-> Projects ===
export const pivotUsersProjects = sqliteTable('pivot_users_projects', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.userId, table.projectId] }),
]);

// === Scout Items ===
export const scoutItems = sqliteTable('scout_items', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  message: text('message').notNull(),
  status: text('status', {
    enum: ['new', 'in_progress', 'review', 'done', 'cancelled'],
  }).notNull().default('new'),
  pageUrl: text('page_url'),
  pageRoute: text('page_route'),
  componentFile: text('component_file'),
  cssSelector: text('css_selector'),
  elementText: text('element_text'),
  elementHtml: text('element_html'),
  viewportWidth: integer('viewport_width'),
  viewportHeight: integer('viewport_height'),
  screenshotPath: text('screenshot_path'),
  sessionRecordingPath: text('session_recording_path'),
  metadata: text('metadata'),  // JSON string: auto-captured environment data (browser, OS, etc.)
  reporterId: text('reporter_id').references(() => users.id, { onDelete: 'set null' }),
  assigneeId: text('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  resolvedById: text('resolved_by_id').references(() => users.id, { onDelete: 'set null' }),
  resolutionNote: text('resolution_note'),
  branchName: text('branch_name'),
  mrUrl: text('mr_url'),
  attemptCount: integer('attempt_count').notNull().default(0),
  resolvedAt: text('resolved_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_items_project_status').on(table.projectId, table.status),
  index('idx_items_project_created').on(table.projectId, table.createdAt),
  index('idx_items_assignee').on(table.assigneeId),
]);

// === Scout Item Notes ===
export const scoutItemNotes = sqliteTable('scout_item_notes', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull().references(() => scoutItems.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  content: text('content').notNull(),
  type: text('type', {
    enum: ['comment', 'status_change', 'assignment'],
  }).notNull().default('comment'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_notes_item_created').on(table.itemId, table.createdAt),
]);

// === Inferred types ===
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ScoutItem = typeof scoutItems.$inferSelect;
export type NewScoutItem = typeof scoutItems.$inferInsert;
export type ScoutItemNote = typeof scoutItemNotes.$inferSelect;
export type ItemStatus = NonNullable<ScoutItem['status']>;
export type UserRole = NonNullable<User['role']>;
