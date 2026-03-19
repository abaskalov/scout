import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { loginSchema } from '../lib/schemas.js';
import { signToken, comparePassword } from '../services/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { UnauthorizedError } from '../lib/errors.js';
import { logAudit, getClientIp } from '../services/audit.js';

export const authRoutes = new Hono()

  .post('/login', zValidator('json', loginSchema), async (c) => {
    const { email, password } = c.req.valid('json');
    const ip = getClientIp(c);

    const user = db.select().from(users).where(eq(users.email, email)).get();
    if (!user || !user.isActive) {
      logAudit({ userId: null, action: 'login_failure', entityType: 'auth', details: { email }, ipAddress: ip });
      throw new UnauthorizedError('Invalid email or password');
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      logAudit({ userId: user.id, action: 'login_failure', entityType: 'auth', details: { email }, ipAddress: ip });
      throw new UnauthorizedError('Invalid email or password');
    }

    logAudit({ userId: user.id, action: 'login', entityType: 'auth', details: { email }, ipAddress: ip });
    const token = signToken(user);
    const { passwordHash: _, ...userWithoutPassword } = user;
    return c.json({ data: { token, user: userWithoutPassword } });
  })

  .post('/me', authMiddleware, async (c) => {
    const user = c.get('user');
    const { passwordHash: _, ...userWithoutPassword } = user;
    return c.json({ data: { user: userWithoutPassword } });
  });
