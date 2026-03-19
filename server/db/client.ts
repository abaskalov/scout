import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const dbPath = process.env.SCOUT_DB_PATH || 'data/scout.db';

// Ensure data directory exists
mkdirSync(dirname(dbPath), { recursive: true });

export const sqlite: DatabaseType = new Database(dbPath);

// Production-critical PRAGMAs
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('busy_timeout = 5000');

// Auto-create tables if they don't exist (production-safe, idempotent)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    allowed_origins TEXT NOT NULL DEFAULT '[]',
    autofix_enabled INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pivot_users_projects (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, project_id)
  );

  CREATE TABLE IF NOT EXISTS scout_items (
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
    metadata TEXT,
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

  CREATE INDEX IF NOT EXISTS idx_items_project_status ON scout_items(project_id, status);
  CREATE INDEX IF NOT EXISTS idx_items_project_created ON scout_items(project_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_items_assignee ON scout_items(assignee_id);

  CREATE TABLE IF NOT EXISTS scout_item_notes (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES scout_items(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'comment',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_notes_item_created ON scout_item_notes(item_id, created_at);
`);

// --- Migrations (safe to re-run, uses IF NOT EXISTS / try-catch) ---
try {
  sqlite.exec(`ALTER TABLE scout_items ADD COLUMN metadata TEXT`);
} catch {
  // Column already exists — OK
}

// Auto-seed admin if users table is empty
const userCount = sqlite.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
if (userCount.cnt === 0) {
  const { randomUUID } = await import('node:crypto');
  const bcryptModule = await import('bcryptjs');
  const bcrypt = bcryptModule.default || bcryptModule;

  const adminId = randomUUID();
  const agentId = randomUUID();
  const projectId = randomUUID();

  const adminHash = bcrypt.hashSync('admin', 10);
  const agentHash = bcrypt.hashSync('agent', 10);

  sqlite.prepare(`INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)`)
    .run(adminId, 'admin@scout.local', adminHash, 'Scout Admin', 'admin');
  sqlite.prepare(`INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)`)
    .run(agentId, 'agent@scout.local', agentHash, 'AI Agent', 'agent');
  sqlite.prepare(`INSERT INTO projects (id, name, slug, allowed_origins) VALUES (?, ?, ?, ?)`)
    .run(projectId, 'My App', 'my-app', '["http://localhost:3000"]');
  sqlite.prepare(`INSERT INTO pivot_users_projects (user_id, project_id) VALUES (?, ?)`)
    .run(agentId, projectId);

  console.log('Auto-seeded: admin@scout.local/admin, agent@scout.local/agent, project My App');
}

export const db = drizzle(sqlite, { schema });
