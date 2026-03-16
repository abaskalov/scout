import { WIDGET_STYLES } from './styles';
import { getToken, login, clearAuth, preloadBridge, restoreAuthFromBridge } from './auth';
import { createFab, showFab, hideFab } from './fab';
import { pickElement, type PickedElement } from './element-picker';
import { createPanel, showPanel, hidePanel, attachPanelEvents, type PanelCallbacks } from './panel';
import { startRecording } from './recorder';

interface ScoutConfig {
  apiUrl: string;
  projectSlug: string;
  /** Set to false to disable widget. Default: true. Override with ?scout=1 in URL. */
  enabled?: boolean;
}

declare global {
  interface Window {
    __SCOUT_CONFIG__?: ScoutConfig;
  }
}

function ensureViewportFitCover(): void {
  const meta = document.querySelector('meta[name="viewport"]');
  if (meta) {
    const content = meta.getAttribute('content') || '';
    if (!content.includes('viewport-fit')) {
      meta.setAttribute('content', content + ', viewport-fit=cover');
    }
  } else {
    const newMeta = document.createElement('meta');
    newMeta.name = 'viewport';
    newMeta.content = 'width=device-width, initial-scale=1.0, viewport-fit=cover';
    document.head.appendChild(newMeta);
  }
}

function init(): void {
  const config = window.__SCOUT_CONFIG__;
  if (!config?.apiUrl || !config?.projectSlug) {
    console.warn('[Scout] Missing window.__SCOUT_CONFIG__ (apiUrl, projectSlug)');
    return;
  }

  // Visibility control: config.enabled + URL override ?scout=1
  const urlOverride = new URLSearchParams(window.location.search).get('scout') === '1';
  if (config.enabled === false && !urlOverride) {
    return; // Widget disabled by config, no URL override
  }

  // Ensure viewport-fit=cover for safe area insets (CapacitorJS)
  ensureViewportFitCover();

  const { apiUrl, projectSlug } = config;

  // Preload auth bridge for cross-site SSO
  preloadBridge(apiUrl);

  // --- Shadow DOM setup ---
  const host = document.createElement('div');
  host.id = 'scout-widget-root';
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

  // Inject styles
  const styleEl = document.createElement('style');
  styleEl.textContent = WIDGET_STYLES;
  shadow.appendChild(styleEl);

  // --- Start rrweb recorder ---
  startRecording();

  // --- Create overlay for element picker ---
  const overlay = document.createElement('div');
  overlay.className = 'scout-overlay hidden';
  shadow.appendChild(overlay);

  const highlight = document.createElement('div');
  highlight.className = 'scout-highlight hidden';
  shadow.appendChild(highlight);

  // --- Create toast ---
  const toast = document.createElement('div');
  toast.className = 'scout-toast';
  shadow.appendChild(toast);

  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  function showToast(message: string, isError = false): void {
    if (toastTimer) clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.toggle('error', isError);
    toast.classList.add('visible');
    toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 3000);
  }

  // --- Create login form container ---
  const loginContainer = document.createElement('div');
  loginContainer.className = 'scout-panel-backdrop hidden';
  const loginPanel = document.createElement('div');
  loginPanel.className = 'scout-panel';

  const loginHeader = document.createElement('div');
  loginHeader.className = 'scout-panel-header';
  const loginTitle = document.createElement('h2');
  loginTitle.textContent = 'Scout — Вход';
  const loginCloseBtn = document.createElement('button');
  loginCloseBtn.className = 'scout-panel-close';
  loginCloseBtn.setAttribute('aria-label', 'Close');
  loginCloseBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
  loginHeader.appendChild(loginTitle);
  loginHeader.appendChild(loginCloseBtn);

  const loginBody = document.createElement('div');
  loginBody.className = 'scout-login';

  const loginSubtitle = document.createElement('h3');
  loginSubtitle.textContent = 'Войдите, чтобы сообщать о багах';

  const loginDesc = document.createElement('p');
  loginDesc.textContent = 'Используйте учётные данные Scout.';

  const emailInput = document.createElement('input');
  emailInput.className = 'scout-input';
  emailInput.type = 'email';
  emailInput.placeholder = 'Эл. почта';
  emailInput.autocomplete = 'email';

  const passwordInput = document.createElement('input');
  passwordInput.className = 'scout-input';
  passwordInput.type = 'password';
  passwordInput.placeholder = 'Пароль';
  passwordInput.autocomplete = 'current-password';

  const loginError = document.createElement('p');
  loginError.className = 'scout-login-error';

  const loginBtn = document.createElement('button');
  loginBtn.className = 'scout-btn scout-btn-primary';
  loginBtn.textContent = 'Log In';

  loginBody.appendChild(loginSubtitle);
  loginBody.appendChild(loginDesc);
  loginBody.appendChild(emailInput);
  loginBody.appendChild(passwordInput);
  loginBody.appendChild(loginError);
  loginBody.appendChild(loginBtn);

  loginPanel.appendChild(loginHeader);
  loginPanel.appendChild(loginBody);
  loginContainer.appendChild(loginPanel);
  shadow.appendChild(loginContainer);

  function showLoginForm(): void {
    emailInput.value = '';
    passwordInput.value = '';
    loginError.textContent = '';
    loginBtn.disabled = false;
    loginBtn.textContent = 'Войти';
    loginContainer.classList.remove('hidden');
    void loginContainer.offsetHeight;
    loginContainer.classList.add('visible');
    loginPanel.classList.add('visible');
    setTimeout(() => emailInput.focus(), 300);
  }

  function hideLoginForm(): void {
    loginPanel.classList.remove('visible');
    loginContainer.classList.remove('visible');
    setTimeout(() => loginContainer.classList.add('hidden'), 250);
  }

  async function handleLogin(): Promise<boolean> {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      loginError.textContent = 'Введите эл. почту и пароль.';
      return false;
    }

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="scout-spinner"></span>Вход...';
    loginError.textContent = '';

    try {
      await login(apiUrl, email, password);
      hideLoginForm();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка входа';
      loginError.textContent = msg;
      loginBtn.disabled = false;
  loginBtn.textContent = 'Войти';
      return false;
    }
  }

  loginBtn.addEventListener('click', async () => {
    const ok = await handleLogin();
    if (ok) {
      startScoutMode();
    }
  });

  // Enter key in password field triggers login
  passwordInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const ok = await handleLogin();
      if (ok) {
        startScoutMode();
      }
    }
  });

  loginCloseBtn.addEventListener('click', () => {
    hideLoginForm();
    showFab(fab);
  });

  // ESC to close login
  function onLoginEsc(e: KeyboardEvent): void {
    if (e.key === 'Escape' && !loginContainer.classList.contains('hidden')) {
      hideLoginForm();
      showFab(fab);
    }
  }
  document.addEventListener('keydown', onLoginEsc, true);

  // --- Create panel ---
  const panelElements = createPanel(shadow);
  let currentPicked: PickedElement | null = null;

  const panelCallbacks: PanelCallbacks = {
    onClose: () => {
      currentPicked = null;
      showFab(fab);
    },
    onSubmitSuccess: () => {
      currentPicked = null;
      showFab(fab);
      showToast('Баг отправлен!');
    },
    onSubmitError: (msg: string) => {
      showToast(msg, true);
    },
  };

  attachPanelEvents(
    panelElements,
    apiUrl,
    projectSlug,
    () => currentPicked,
    panelCallbacks,
  );

  // ESC to close panel
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panelElements.backdrop.classList.contains('hidden')) {
      hidePanel(panelElements);
      panelCallbacks.onClose();
    }
  }, true);

  // --- Scout mode ---
  async function startScoutMode(): Promise<void> {
    hideFab(fab);

    const picked = await pickElement(shadow, overlay, highlight);

    if (!picked) {
      // Cancelled
      showFab(fab);
      return;
    }

    currentPicked = picked;
    showPanel(panelElements, picked);
  }

  // --- Create FAB ---
  const fab = createFab(async () => {
    // Try to restore auth from bridge (cross-site SSO)
    if (!getToken()) {
      await restoreAuthFromBridge(apiUrl);
    }
    const token = getToken();
    if (!token) {
      hideFab(fab);
      showLoginForm();
    } else {
      startScoutMode();
    }
  });
  shadow.appendChild(fab);
}

// --- Auto-init ---
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
