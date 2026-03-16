import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../server/db/schema.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env.SCOUT_JWT_SECRET || 'dev-secret-change-in-production';

export interface TestContext {
  db: ReturnType<typeof drizzle<typeof schema>>;
  adminId: string;
  agentId: string;
  memberId: string;
  projectId: string;
  adminToken: string;
  agentToken: string;
  memberToken: string;
}

/**
 * Creates in-memory SQLite DB with schema and seed data.
 * Call in beforeEach() for test isolation.
 */
export function createTestContext(): TestContext {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');

  // Create tables manually (drizzle-kit push doesn't work with in-memory)
  sqlite.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      allowed_origins TEXT NOT NULL DEFAULT '[]',
      autofix_enabled INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE pivot_users_projects (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, project_id)
    );

    CREATE TABLE scout_items (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      page_url TEXT,
      page_route TEXT,
      component_file TEXT,
      css_selector TEXT,
      element_text TEXT,
      element_html TEXT,
      viewport_width INTEGER,
      viewport_height INTEGER,
      screenshot_path TEXT,
      session_recording_path TEXT,
      reporter_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      resolved_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      resolution_note TEXT,
      branch_name TEXT,
      mr_url TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      resolved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX idx_items_project_status ON scout_items(project_id, status);
    CREATE INDEX idx_items_project_created ON scout_items(project_id, created_at);
    CREATE INDEX idx_items_assignee ON scout_items(assignee_id);

    CREATE TABLE scout_item_notes (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES scout_items(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'comment',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX idx_notes_item_created ON scout_item_notes(item_id, created_at);
  `);

  const db = drizzle(sqlite, { schema });

  // Seed data
  const projectId = randomUUID();
  const adminId = randomUUID();
  const agentId = randomUUID();
  const memberId = randomUUID();
  const passwordHash = bcrypt.hashSync('password', 10);

  db.insert(schema.projects).values({
    id: projectId, name: 'Test Project', slug: 'test-project',
    allowedOrigins: '["http://localhost:3000"]', autofixEnabled: true,
  }).run();

  db.insert(schema.users).values([
    { id: adminId, email: 'admin@test.local', passwordHash, name: 'Test Admin', role: 'admin' },
    { id: agentId, email: 'agent@test.local', passwordHash, name: 'Test Agent', role: 'agent' },
    { id: memberId, email: 'member@test.local', passwordHash, name: 'Test Member', role: 'member' },
  ]).run();

  db.insert(schema.pivotUsersProjects).values([
    { userId: agentId, projectId },
    { userId: memberId, projectId },
  ]).run();

  // Generate tokens
  const adminToken = jwt.sign({ userId: adminId, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
  const agentToken = jwt.sign({ userId: agentId, role: 'agent' }, JWT_SECRET, { expiresIn: '1h' });
  const memberToken = jwt.sign({ userId: memberId, role: 'member' }, JWT_SECRET, { expiresIn: '1h' });

  return { db, adminId, agentId, memberId, projectId, adminToken, agentToken, memberToken };
}
