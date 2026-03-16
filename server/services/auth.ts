import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { User } from '../db/schema.js';

const JWT_SECRET = process.env.SCOUT_JWT_SECRET || 'dev-secret-change-in-production';
const JWT_TTL = '30d';

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
