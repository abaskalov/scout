import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { User } from '../db/schema.js';
import { logger } from '../lib/logger.js';

// --- JWT secret enforcement ---
const isProduction = process.env.NODE_ENV === 'production';
const rawSecret = process.env.SCOUT_JWT_SECRET;
const DEFAULT_SECRET = 'dev-secret-change-in-production';

if (isProduction && (!rawSecret || rawSecret === DEFAULT_SECRET)) {
  logger.fatal(
    'SCOUT_JWT_SECRET is missing or uses the default value. '
    + 'Set a strong unique secret via environment variable. THIS IS A SECURITY RISK.',
  );
}

if (!isProduction && (!rawSecret || rawSecret === DEFAULT_SECRET)) {
  logger.warn('Using default JWT secret. Set SCOUT_JWT_SECRET for production.');
}

const JWT_SECRET = rawSecret || DEFAULT_SECRET;
const JWT_TTL = '7d';

export interface JWTPayload {
  userId: string;
  role: string;
}

export function signToken(user: User): string {
  const payload: JWTPayload = { userId: user.id, role: user.role };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_TTL });
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
