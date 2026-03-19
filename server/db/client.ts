import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { type BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.js';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { logger } from '../lib/logger.js';

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
    priority TEXT DEFAULT 'medium',
    labels TEXT,
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

  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    details TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
  CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);

  CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret TEXT,
    events TEXT NOT NULL DEFAULT '["item.created","item.status_changed"]',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_webhooks_project ON webhooks(project_id);
  CREATE INDEX IF NOT EXISTS idx_webhooks_project_active ON webhooks(project_id, is_active);

  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    last_used_at TEXT,
    expires_at TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
  CREATE INDEX IF NOT EXISTS idx_api_keys_project ON api_keys(project_id);
`);

// --- Migrations (safe to re-run, uses IF NOT EXISTS / try-catch) ---
try {
  sqlite.exec(`ALTER TABLE scout_items ADD COLUMN metadata TEXT`);
} catch {
  // Column already exists — OK
}
try {
  sqlite.exec(`ALTER TABLE scout_items ADD COLUMN priority TEXT DEFAULT 'medium'`);
} catch {
  // Column already exists — OK
}
try {
  sqlite.exec(`ALTER TABLE scout_items ADD COLUMN labels TEXT`);
} catch {
  // Column already exists — OK
}

// --- Apply pending drizzle-kit migrations (for future schema changes) ---
export const db: BetterSQLite3Database<typeof schema> = drizzle(sqlite, { schema });

const migrationsFolder = join(process.cwd(), 'drizzle');
if (existsSync(migrationsFolder)) {
  try {
    migrate(db, { migrationsFolder });
    logger.debug('Drizzle migrations applied');
  } catch (err) {
    logger.warn({ err }, 'Drizzle migration failed');
  }
}

// --- Auto-seed logic ---
const isProduction = process.env.NODE_ENV === 'production';
const userCount = sqlite.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };

if (userCount.cnt === 0) {
  if (isProduction) {
    // In production: use env vars or log instructions
    const adminEmail = process.env.SCOUT_ADMIN_EMAIL;
    const adminPassword = process.env.SCOUT_ADMIN_PASSWORD;

    if (adminEmail) {
      const bcryptModule = await import('bcryptjs');
      const bcrypt = bcryptModule.default || bcryptModule;

      // If no password provided, generate a secure random one
      const password = adminPassword || randomBytes(24).toString('base64url');
      const adminHash = bcrypt.hashSync(password, 10);
      const adminId = randomUUID();

      sqlite.prepare(`INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)`)
        .run(adminId, adminEmail, adminHash, 'Scout Admin', 'admin');

      if (!adminPassword) {
        logger.info({ email: adminEmail }, 'Admin user created');
        logger.info({ password }, 'Generated password — change immediately after first login');
      } else {
        logger.info({ email: adminEmail }, 'Admin user created');
      }
    } else {
      logger.info('No users found. Create an admin user via SCOUT_ADMIN_EMAIL and SCOUT_ADMIN_PASSWORD env vars');
    }
  } else {
    // Development: seed with default credentials
    const bcryptModule = await import('bcryptjs');
    const bcrypt = bcryptModule.default || bcryptModule;

    const adminEmail = process.env.SCOUT_ADMIN_EMAIL || 'admin@scout.local';
    const adminPassword = process.env.SCOUT_ADMIN_PASSWORD || 'admin';
    const agentPassword = 'agent';

    const adminId = randomUUID();
    const agentId = randomUUID();
    const projectId = randomUUID();

    const adminHash = bcrypt.hashSync(adminPassword, 10);
    const agentHash = bcrypt.hashSync(agentPassword, 10);

    sqlite.prepare(`INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)`)
      .run(adminId, adminEmail, adminHash, 'Scout Admin', 'admin');
    sqlite.prepare(`INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)`)
      .run(agentId, 'agent@scout.local', agentHash, 'AI Agent', 'agent');
    sqlite.prepare(`INSERT INTO projects (id, name, slug, allowed_origins) VALUES (?, ?, ?, ?)`)
      .run(projectId, 'My App', 'my-app', '["http://localhost:3000"]');
    sqlite.prepare(`INSERT INTO pivot_users_projects (user_id, project_id) VALUES (?, ?)`)
      .run(agentId, projectId);

    logger.info({ adminEmail }, 'Auto-seeded dev users and project');
  }
}
