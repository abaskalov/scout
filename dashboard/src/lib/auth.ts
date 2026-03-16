import { api } from './api';

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'member' | 'agent';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function getToken(): string | null {
  return localStorage.getItem('scout_token');
}

export function getUser(): User | null {
  const raw = localStorage.getItem('scout_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function isAdmin(): boolean {
  const user = getUser();
  return user?.role === 'admin';
}

export async function login(
  email: string,
  password: string,
): Promise<{ token: string; user: User }> {
  const result = await api<{ token: string; user: User }>('/api/auth/login', {
    email,
    password,
  });
  localStorage.setItem('scout_token', result.token);
  localStorage.setItem('scout_user', JSON.stringify(result.user));
  return result;
}

export function logout(): void {
  localStorage.removeItem('scout_token');
  localStorage.removeItem('scout_user');
  window.location.href = '/login';
}

export async function fetchMe(): Promise<User> {
  const result = await api<{ user: User }>('/api/auth/me');
  localStorage.setItem('scout_user', JSON.stringify(result.user));
  return result.user;
}
