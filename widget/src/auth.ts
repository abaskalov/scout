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

// --- Auth Bridge (cross-site SSO via hidden iframe) ---

let bridgeIframe: HTMLIFrameElement | null = null;
let bridgeReady = false;
let bridgeApiUrl: string | null = null;

function initBridge(apiUrl: string): Promise<void> {
  if (bridgeIframe) return Promise.resolve();
  bridgeApiUrl = apiUrl;

  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.src = `${apiUrl}/widget/auth-bridge.html`;
    iframe.style.cssText = 'display:none;width:0;height:0;border:0;position:absolute;';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);
    bridgeIframe = iframe;

    iframe.onload = () => {
      bridgeReady = true;
      resolve();
    };
    // Fallback: resolve after 2s even if iframe fails
    setTimeout(() => { bridgeReady = true; resolve(); }, 2000);
  });
}

function bridgePost(action: string, data?: Record<string, unknown>): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    if (!bridgeIframe?.contentWindow || !bridgeReady) {
      resolve({});
      return;
    }

    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'scout-auth-bridge') {
        window.removeEventListener('message', handler);
        resolve(e.data);
      }
    };
    window.addEventListener('message', handler);
    bridgeIframe.contentWindow.postMessage(
      { type: 'scout-auth-bridge', action, ...data },
      '*',
    );
    // Timeout fallback
    setTimeout(() => { window.removeEventListener('message', handler); resolve({}); }, 1000);
  });
}

// --- Local storage helpers ---

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

function saveLocal(token: string, user: ScoutUser): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch { /* localStorage may be blocked */ }
}

function clearLocal(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch { /* ignore */ }
}

// --- Public API ---

/**
 * Save auth to local + bridge (cross-site).
 */
export function saveAuth(token: string, user: ScoutUser): void {
  saveLocal(token, user);
  bridgePost('set', { token, user });
}

/**
 * Clear auth from local + bridge.
 */
export function clearAuth(): void {
  clearLocal();
  bridgePost('clear');
}

/**
 * Try to restore auth from bridge if not in local storage.
 * Call this on widget init to pick up cross-site sessions.
 */
export async function restoreAuthFromBridge(apiUrl: string): Promise<boolean> {
  // Already have local token
  if (getToken()) return true;

  await initBridge(apiUrl);
  const result = await bridgePost('get');
  const token = result.token as string | null;
  const user = result.user as ScoutUser | null;

  if (token && user) {
    saveLocal(token, user);
    return true;
  }
  return false;
}

/**
 * Initialize bridge iframe. Call early so it's ready by the time user interacts.
 */
export function preloadBridge(apiUrl: string): void {
  initBridge(apiUrl);
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
  saveAuth(token, user); // saves to local + bridge
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
