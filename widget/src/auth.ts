const TOKEN_KEY = '__scout_token__';
const USER_KEY = '__scout_user__';

interface ScoutUser {
  id: string;
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
  } catch { /* localStorage may be blocked */ }
}

export function clearAuth(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch { /* ignore */ }
}

export async function login(apiUrl: string, email: string, password: string): Promise<{ token: string; user: ScoutUser }> {
  const res = await fetch(`${apiUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? body?.message ?? `Ошибка входа (${res.status})`);
  }

  const json: LoginResponse = await res.json();
  const { token, user } = json.data;
  saveAuth(token, user);
  return { token, user };
}

let cachedProjectId: string | null = null;

export async function resolveProjectId(apiUrl: string, projectSlug: string): Promise<string> {
  if (cachedProjectId !== null) return cachedProjectId;

  const token = getToken();
  if (!token) throw new Error('Вы не авторизованы');

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
      throw new Error('Сессия истекла. Войдите снова.');
    }
    throw new Error(`Не удалось загрузить проекты (${res.status})`);
  }

  const json = await res.json();
  const items: Array<{ id: string; slug: string }> = json.data?.items ?? [];
  const project = items.find((p) => p.slug === projectSlug);

  if (!project) {
    throw new Error(`Проект «${projectSlug}» не найден`);
  }

  cachedProjectId = project.id;
  return project.id;
}

export function resetProjectCache(): void {
  cachedProjectId = null;
}
