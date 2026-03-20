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

// --- In-memory cache (populated from SSO iframe or localStorage fallback) ---
let cachedToken: string | null = null;
let cachedUser: ScoutUser | null = null;

// --- SSO iframe bridge ---
let ssoIframe: HTMLIFrameElement | null = null;
let ssoReady = false;
let ssoOrigin = '';
let msgId = 0;
const pendingMessages = new Map<number, (data: Record<string, unknown>) => void>();

const SSO_INIT_TIMEOUT_MS = 3_000;
const SSO_MSG_TIMEOUT_MS = 2_000;

/**
 * Initialize SSO by creating a hidden iframe to the Scout API origin.
 * The iframe stores auth tokens in its own localStorage (scout.kafu.kz),
 * making them accessible from any site where the widget is embedded.
 *
 * Falls back to host localStorage if iframe fails (Safari ITP, etc.)
 */
export async function initSSO(apiUrl: string): Promise<void> {
  ssoOrigin = new URL(apiUrl).origin;

  // If widget is on the same origin as the API, no need for iframe
  if (window.location.origin === ssoOrigin) {
    loadFromLocalStorage();
    return;
  }

  try {
    // Listen for messages from SSO iframe
    window.addEventListener('message', onSSOMessage);

    // Create hidden iframe
    ssoIframe = document.createElement('iframe');
    ssoIframe.src = `${apiUrl}/auth/sso`;
    ssoIframe.style.cssText = 'display:none;width:0;height:0;border:none;position:absolute';
    ssoIframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ssoIframe);

    // Wait for iframe to load and respond to ping
    await waitForIframe();
    ssoReady = true;

    // Try to get existing token from SSO iframe
    const data = await sendSSOMessage('getToken');
    if (data.token && typeof data.token === 'string') {
      cachedToken = data.token;
      if (data.user && typeof data.user === 'string') {
        try { cachedUser = JSON.parse(data.user); } catch { /* ignore */ }
      }
      // Sync to local localStorage as backup
      saveToLocalStorage(cachedToken, cachedUser);
    } else {
      // No SSO token — try local localStorage
      loadFromLocalStorage();
    }
  } catch {
    // SSO iframe failed (Safari ITP, network error, etc.) — fallback to localStorage
    ssoReady = false;
    loadFromLocalStorage();
  }
}

function onSSOMessage(e: MessageEvent): void {
  const data = e.data;
  if (!data || data.ns !== 'scout-sso' || typeof data.id !== 'number') return;

  const resolve = pendingMessages.get(data.id);
  if (resolve) {
    pendingMessages.delete(data.id);
    resolve(data);
  }
}

function sendSSOMessage(cmd: string, payload?: Record<string, string>): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    if (!ssoIframe?.contentWindow) {
      reject(new Error('SSO iframe not available'));
      return;
    }

    const id = ++msgId;
    const timer = setTimeout(() => {
      pendingMessages.delete(id);
      reject(new Error('SSO message timeout'));
    }, SSO_MSG_TIMEOUT_MS);

    pendingMessages.set(id, (data) => {
      clearTimeout(timer);
      resolve(data);
    });

    ssoIframe.contentWindow.postMessage(
      { ns: 'scout-sso', id, cmd, ...payload },
      ssoOrigin,
    );
  });
}

function waitForIframe(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ssoIframe) { reject(new Error('No iframe')); return; }

    let attempts = 0;
    const maxAttempts = Math.ceil(SSO_INIT_TIMEOUT_MS / 200);

    function tryPing(): void {
      attempts++;
      sendSSOMessage('ping')
        .then(() => resolve())
        .catch(() => {
          if (attempts >= maxAttempts) {
            reject(new Error('SSO iframe timeout'));
          } else {
            setTimeout(tryPing, 200);
          }
        });
    }

    // Wait for iframe to load first
    ssoIframe.addEventListener('load', () => setTimeout(tryPing, 50), { once: true });

    // Fallback if load event doesn't fire
    setTimeout(() => {
      if (attempts === 0) tryPing();
    }, 500);
  });
}

// --- localStorage fallback ---
function loadFromLocalStorage(): void {
  try {
    cachedToken = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY);
    cachedUser = raw ? JSON.parse(raw) : null;
  } catch {
    cachedToken = null;
    cachedUser = null;
  }
}

function saveToLocalStorage(token: string | null, user: ScoutUser | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  } catch { /* localStorage may be blocked */ }
}

// --- Public API (same interface as before) ---

export function getToken(): string | null {
  return cachedToken;
}

export function getUser(): ScoutUser | null {
  return cachedUser;
}

export function saveAuth(token: string, user: ScoutUser): void {
  cachedToken = token;
  cachedUser = user;

  // Save to local localStorage (always)
  saveToLocalStorage(token, user);

  // Save to SSO iframe (cross-domain persistence)
  if (ssoReady) {
    sendSSOMessage('setToken', {
      token,
      user: JSON.stringify(user),
    }).catch(() => { /* SSO save failed — local storage is fallback */ });
  }
}

export function clearAuth(): void {
  cachedToken = null;
  cachedUser = null;

  // Clear local localStorage
  saveToLocalStorage(null, null);

  // Clear SSO iframe
  if (ssoReady) {
    sendSSOMessage('clearToken').catch(() => { /* ignore */ });
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
