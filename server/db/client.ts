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

export const db = drizzle(sqlite, { schema });
