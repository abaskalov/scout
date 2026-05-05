import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { type BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.js';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { logger } from '../lib/logger.js';
import { ensureSqliteSchema, hasCoreTables } from './sqlite-schema.js';

const dbPath = process.env.SCOUT_DB_PATH || 'data/scout.db';

// Ensure data directory exists
mkdirSync(dirname(dbPath), { recursive: true });

export const sqlite: DatabaseType = new Database(dbPath);

// Production-critical PRAGMAs
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('busy_timeout = 5000');

// --- Apply pending drizzle-kit migrations (for future schema changes) ---
export const db: BetterSQLite3Database<typeof schema> = drizzle(sqlite, { schema });

const migrationsFolder = join(process.cwd(), 'drizzle');
if (existsSync(migrationsFolder)) {
  const legacySchema = hasCoreTables(sqlite);
  if (legacySchema) {
    ensureSqliteSchema(sqlite, { migrationsFolder, adoptBaseline: true });
  }
  try {
    migrate(db, { migrationsFolder });
    ensureSqliteSchema(sqlite);
    logger.debug('Drizzle migrations applied');
  } catch (err) {
    logger.error({ err }, 'Drizzle migration failed');
    throw err;
  }
} else {
  ensureSqliteSchema(sqlite);
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
