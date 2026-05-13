import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../server/db/schema.js';
import { createSqliteBaseline } from '../server/db/sqlite-schema.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env.SCOUT_JWT_SECRET || 'dev-secret-change-in-production';

export interface TestContext {
  db: ReturnType<typeof drizzle<typeof schema>>;
  adminId: string;
  developerId: string;
  memberId: string;
  projectId: string;
  adminToken: string;
  developerToken: string;
  memberToken: string;
}

/**
 * Creates in-memory SQLite DB with schema and seed data.
 * Call in beforeEach() for test isolation.
 */
export function createTestContext(): TestContext {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  createSqliteBaseline(sqlite);

  const db = drizzle(sqlite, { schema });

  // Seed data
  const projectId = randomUUID();
  const adminId = randomUUID();
  const developerId = randomUUID();
  const memberId = randomUUID();
  const passwordHash = bcrypt.hashSync('password', 10);

  db.insert(schema.projects).values({
    id: projectId, name: 'Test Project', slug: 'test-project',
    allowedOrigins: '["http://localhost:3000"]',
  }).run();

  db.insert(schema.users).values([
    { id: adminId, email: 'admin@test.local', passwordHash, name: 'Test Admin', role: 'admin' },
    { id: developerId, email: 'developer@test.local', passwordHash, name: 'Test Developer', role: 'member' },
    { id: memberId, email: 'member@test.local', passwordHash, name: 'Test Member', role: 'member' },
  ]).run();

  db.insert(schema.pivotUsersProjects).values([
    { userId: developerId, projectId, role: 'developer' },
    { userId: memberId, projectId, role: 'reporter' },
  ]).run();

  // Generate tokens
  const adminToken = jwt.sign({ userId: adminId, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
  const developerToken = jwt.sign({ userId: developerId, role: 'member' }, JWT_SECRET, { expiresIn: '1h' });
  const memberToken = jwt.sign({ userId: memberId, role: 'member' }, JWT_SECRET, { expiresIn: '1h' });

  return { db, adminId, developerId, memberId, projectId, adminToken, developerToken, memberToken };
}
