import { db } from './client.js';
import { projects, users, pivotUsersProjects } from './schema.js';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

function seed() {
  console.log('Seeding Scout database...');

  // Project: Avtozor
  const existingProject = db.select().from(projects).where(eq(projects.slug, 'avtozor')).get();
  if (!existingProject) {
    db.insert(projects).values({
      id: randomUUID(),
      name: 'Avtozor',
      slug: 'avtozor',
      allowedOrigins: JSON.stringify(['http://localhost:3002', 'http://localhost:3001']),
      autofixEnabled: true,
    }).run();
    console.log('  Created project: Avtozor');
  } else {
    console.log('  Project Avtozor already exists, skipping');
  }

  // Admin
  const existingAdmin = db.select().from(users).where(eq(users.email, 'admin@scout.local')).get();
  if (!existingAdmin) {
    db.insert(users).values({
      id: randomUUID(),
      email: 'admin@scout.local',
      passwordHash: bcrypt.hashSync('admin', 10),
      name: 'Scout Admin',
      role: 'admin',
    }).run();
    console.log('  Created user: admin@scout.local / admin');
  } else {
    console.log('  Admin already exists, skipping');
  }

  // Agent
  const existingAgent = db.select().from(users).where(eq(users.email, 'agent@scout.local')).get();
  if (!existingAgent) {
    db.insert(users).values({
      id: randomUUID(),
      email: 'agent@scout.local',
      passwordHash: bcrypt.hashSync('agent', 10),
      name: 'AI Agent',
      role: 'agent',
    }).run();
    console.log('  Created user: agent@scout.local / agent');
  } else {
    console.log('  Agent already exists, skipping');
  }

  // Pivot: agent → avtozor
  const agent = db.select().from(users).where(eq(users.email, 'agent@scout.local')).get();
  const project = db.select().from(projects).where(eq(projects.slug, 'avtozor')).get();

  if (agent && project) {
    const existing = db.select().from(pivotUsersProjects)
      .where(eq(pivotUsersProjects.userId, agent.id)).get();
    if (!existing) {
      db.insert(pivotUsersProjects).values({
        userId: agent.id,
        projectId: project.id,
      }).run();
      console.log('  Linked AI Agent → Avtozor');
    }
  }

  console.log('Seed complete!');
}

seed();
