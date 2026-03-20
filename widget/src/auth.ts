const TOKEN_KEY = '__scout_token__';
const USER_KEY = '__scout_user__';
const COOKIE_TOKEN = 'scout_t';
const COOKIE_USER = 'scout_u';
const COOKIE_MAX_AGE = 604_800; // 7 days (matches JWT TTL)

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

// --- In-memory cache ---
let cachedToken: string | null = null;
let cachedUser: ScoutUser | null = null;

// --- SSO iframe bridge (cross-domain, works in Chrome) ---
let ssoIframe: HTMLIFrameElement | null = null;
let ssoReady = false;
let ssoOrigin = '';
let msgId = 0;
const pendingMessages = new Map<number, (data: Record<string, unknown>) => void>();

const SSO_INIT_TIMEOUT_MS = 3_000;
const SSO_MSG_TIMEOUT_MS = 2_000;

// ============================================================
// Cookie-based SSO for subdomains (works in ALL browsers)
// stg.avtozor.uz and stgadmin.avtozor.uz share .avtozor.uz cookies
// ============================================================

/**
 * Extract parent domain for cookie sharing between subdomains.
 * stg.avtozor.uz → .avtozor.uz
 * stgadmin.avtozor.uz → .avtozor.uz
 * Returns null for localhost / IP addresses / bare domains.
 */
function getParentDomain(): string | null {
  const hostname = window.location.hostname;
  // Skip localhost and IP addresses
  if (hostname === 'localhost' || /^\d+(\.\d+){3}$/.test(hostname)) return null;

  const parts = hostname.split('.');
  // Need at least 3 parts (sub.domain.tld) to set parent domain cookie
  if (parts.length < 3) return null;

  // Use last 2 parts as parent domain
  // Browser will silently reject if it's a public suffix (e.g. .co.uk)
  return '.' + parts.slice(-2).join('.');
}

function saveToCookie(token: string, user: ScoutUser): void {
  const domain = getParentDomain();
  if (!domain) return;

  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  const base = `path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}; domain=${domain}`;

  try {
    document.cookie = `${COOKIE_TOKEN}=${token}; ${base}`;
    document.cookie = `${COOKIE_USER}=${encodeURIComponent(JSON.stringify(user))}; ${base}`;
  } catch { /* cookie API blocked */ }
}

function loadFromCookie(): boolean {
  try {
    const cookies = document.cookie.split(';');
    let token: string | null = null;
    let user: ScoutUser | null = null;

    for (const c of cookies) {
      const trimmed = c.trim();
      if (trimmed.startsWith(COOKIE_TOKEN + '=')) {
        token = trimmed.slice(COOKIE_TOKEN.length + 1);
      }
      if (trimmed.startsWith(COOKIE_USER + '=')) {
        try {
          user = JSON.parse(decodeURIComponent(trimmed.slice(COOKIE_USER.length + 1)));
        } catch { /* malformed user cookie */ }
      }
    }

    if (token) {
      cachedToken = token;
      cachedUser = user;
      // Sync to localStorage as backup
      saveToLocalStorage(token, user);
      return true;
    }
  } catch { /* cookie API blocked */ }
  return false;
}

function clearCookie(): void {
  const domain = getParentDomain();
  if (!domain) return;

  try {
    document.cookie = `${COOKIE_TOKEN}=; path=/; max-age=0; domain=${domain}`;
    document.cookie = `${COOKIE_USER}=; path=/; max-age=0; domain=${domain}`;
  } catch { /* ignore */ }
}

// ============================================================
// SSO iframe bridge (cross-domain, Chrome + Firefox)
// ============================================================

/**
 * Initialize SSO. Token resolution priority:
 * 1. Cookie (subdomain sharing — works in ALL browsers including Safari)
 * 2. SSO iframe (cross-domain — works in Chrome, blocked by Safari ITP)
 * 3. Host localStorage (single-origin fallback)
 */
export async function initSSO(apiUrl: string): Promise<void> {
  ssoOrigin = new URL(apiUrl).origin;

  // 1. Try cookie first (subdomain SSO — most reliable)
  if (loadFromCookie()) return;

  // 2. If same origin, just use localStorage
  if (window.location.origin === ssoOrigin) {
    loadFromLocalStorage();
    return;
  }

  // 3. Try iframe SSO (cross-domain)
  try {
    window.addEventListener('message', onSSOMessage);

    ssoIframe = document.createElement('iframe');
    ssoIframe.src = `${apiUrl}/auth/sso`;
    ssoIframe.style.cssText = 'display:none;width:0;height:0;border:none;position:absolute';
    ssoIframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ssoIframe);

    await waitForIframe();
    ssoReady = true;

    const data = await sendSSOMessage('getToken');
    if (data.token && typeof data.token === 'string') {
      cachedToken = data.token;
      if (data.user && typeof data.user === 'string') {
        try { cachedUser = JSON.parse(data.user); } catch { /* ignore */ }
      }
      saveToLocalStorage(cachedToken, cachedUser);
      return;
    }
  } catch {
    ssoReady = false;
  }

  // 4. Fallback to host localStorage
  loadFromLocalStorage();
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

    ssoIframe.addEventListener('load', () => setTimeout(tryPing, 50), { once: true });
    setTimeout(() => { if (attempts === 0) tryPing(); }, 500);
  });
}

// ============================================================
// localStorage fallback (single-origin)
// ============================================================

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

// ============================================================
// Popup-based SSO (cross-domain, works in ALL browsers)
// Opens scout.kafu.kz/auth/sso/popup in a popup window.
// The popup reads its first-party cookie and sends token via postMessage.
// ============================================================

const POPUP_POLL_INTERVAL_MS = 300;

/**
 * Try to authenticate via popup SSO.
 * Opens a popup to the Scout API origin where the session cookie is first-party.
 * Returns true if authenticated, false if popup was blocked or user closed it.
 */
export function tryPopupSSO(apiUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    const w = 420;
    const h = 540;
    const left = Math.round((screen.width - w) / 2);
    const top = Math.round((screen.height - h) / 2);

    const popup = window.open(
      `${apiUrl}/auth/sso/popup`,
      'scout-sso',
      `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=no`,
    );

    if (!popup) {
      // Popup blocked by browser
      resolve(false);
      return;
    }

    function onMessage(e: MessageEvent): void {
      const data = e.data;
      if (!data || data.ns !== 'scout-sso-popup') return;

      window.removeEventListener('message', onMessage);
      clearInterval(pollTimer);

      if (data.token && typeof data.token === 'string') {
        cachedToken = data.token;
        try { cachedUser = data.user ? JSON.parse(data.user) : null; } catch { cachedUser = null; }

        // Save to all storage layers
        saveToCookie(cachedToken, cachedUser);
        saveToLocalStorage(cachedToken, cachedUser);
        if (ssoReady) {
          sendSSOMessage('setToken', {
            token: cachedToken,
            user: data.user ?? '',
          }).catch(() => { /* ignore */ });
        }

        resolve(true);
      } else {
        resolve(false);
      }
    }

    window.addEventListener('message', onMessage);

    // Poll for popup close (user closed without completing auth)
    const pollTimer = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(pollTimer);
          window.removeEventListener('message', onMessage);
          // Small delay to allow pending postMessage to arrive
          setTimeout(() => resolve(false), 100);
        }
      } catch { /* cross-origin access error — popup still open */ }
    }, POPUP_POLL_INTERVAL_MS);
  });
}

// ============================================================
// Public API
// ============================================================

export function getToken(): string | null {
  return cachedToken;
}

export function getUser(): ScoutUser | null {
  return cachedUser;
}

export function saveAuth(token: string, user: ScoutUser): void {
  cachedToken = token;
  cachedUser = user;

  // 1. Cookie (subdomain SSO — works everywhere)
  saveToCookie(token, user);

  // 2. localStorage (host fallback)
  saveToLocalStorage(token, user);

  // 3. SSO iframe (cross-domain)
  if (ssoReady) {
    sendSSOMessage('setToken', {
      token,
      user: JSON.stringify(user),
    }).catch(() => { /* SSO save failed — cookie + localStorage are fallbacks */ });
  }
}

export function clearAuth(): void {
  cachedToken = null;
  cachedUser = null;

  clearCookie();
  saveToLocalStorage(null, null);

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
