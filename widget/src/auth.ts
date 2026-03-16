const TOKEN_KEY = '__scout_token__';
const USER_KEY = '__scout_user__';

interface ScoutUser {
  id: number;
  email: string;
  name?: string;
}

interface LoginResponse {
  data: {
    token: string;
    user: ScoutUser;
  };
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getUser(): ScoutUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAuth(token: string, user: ScoutUser): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // localStorage may be blocked; proceed without persistence
  }
}

export function clearAuth(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}

export async function login(apiUrl: string, email: string, password: string): Promise<{ token: string; user: ScoutUser }> {
  const res = await fetch(`${apiUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Login failed (${res.status})`);
  }

  const json: LoginResponse = await res.json();
  const { token, user } = json.data;
  saveAuth(token, user);
  return { token, user };
}

let cachedProjectId: number | null = null;

export async function resolveProjectId(apiUrl: string, projectSlug: string): Promise<number> {
  if (cachedProjectId !== null) return cachedProjectId;

  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${apiUrl}/api/projects/list`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearAuth();
      throw new Error('Session expired. Please log in again.');
    }
    throw new Error(`Failed to fetch projects (${res.status})`);
  }

  const json = await res.json();
  const items: Array<{ id: number; slug: string }> = json.data?.items ?? [];
  const project = items.find((p) => p.slug === projectSlug);

  if (!project) {
    throw new Error(`Project "${projectSlug}" not found`);
  }

  cachedProjectId = project.id;
  return project.id;
}

export function resetProjectCache(): void {
  cachedProjectId = null;
}
