import type { PickedElement } from './element-picker';
import { captureScreenshot, SCREENSHOT_MIME } from './screenshot';
import { getRecordingCompressed, resetBuffer, isRecordingAvailable } from './recorder';
import { getToken, getUser, clearAuth, resolveProjectId, resetProjectCache } from './auth';

interface PanelElements {
  backdrop: HTMLDivElement;
  panel: HTMLDivElement;
  selectorDisplay: HTMLDivElement;
  textDisplay: HTMLDivElement;
  textarea: HTMLTextAreaElement;
  charCount: HTMLSpanElement;
  prioritySelect: HTMLSelectElement;
  screenshotCheckbox: HTMLInputElement;
  recordingCheckbox: HTMLInputElement;
  submitBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
  progressStatus: HTMLDivElement;
  screenshotPreview: HTMLDivElement;
}

export interface PanelCallbacks {
  onClose: () => void;
  onSubmitSuccess: () => void;
  onSubmitError: (msg: string) => void;
  onLogout: () => void;
}

/**
 * Auto-capture environment metadata (Marker.io/Usersnap pattern).
 * All professional tools capture this silently — no checkboxes needed.
 */
function collectMetadata(): Record<string, string> {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  let os = 'Unknown';

  // Browser detection
  if (ua.includes('Firefox/')) browser = 'Firefox ' + (ua.match(/Firefox\/([\d.]+)/)?.[1] ?? '');
  else if (ua.includes('Edg/')) browser = 'Edge ' + (ua.match(/Edg\/([\d.]+)/)?.[1] ?? '');
  else if (ua.includes('Chrome/') && !ua.includes('Edg/')) browser = 'Chrome ' + (ua.match(/Chrome\/([\d.]+)/)?.[1] ?? '');
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari ' + (ua.match(/Version\/([\d.]+)/)?.[1] ?? '');

  // OS detection
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS X')) os = 'macOS ' + (ua.match(/Mac OS X ([\d_.]+)/)?.[1]?.replace(/_/g, '.') ?? '');
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android ' + (ua.match(/Android ([\d.]+)/)?.[1] ?? '');
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS ' + (ua.match(/OS ([\d_]+)/)?.[1]?.replace(/_/g, '.') ?? '');

  return {
    browser,
    os,
    language: navigator.language,
    devicePixelRatio: String(window.devicePixelRatio),
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

// --- Retry with exponential backoff (Sentry pattern: 3 retries, 1/2/4s) ---
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 1_000;

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  onRetry?: (attempt: number, maxAttempts: number) => void,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, options);

      // Don't retry client errors (4xx) — they won't succeed
      if (res.status >= 400 && res.status < 500) return res;

      // Retry server errors (5xx)
      if (!res.ok && attempt < MAX_RETRIES) {
        throw new Error(`Server error (${res.status})`);
      }

      return res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY * Math.pow(2, attempt); // 1s, 2s, 4s
        onRetry?.(attempt + 1, MAX_RETRIES);
        await sleep(delay);
      }
    }
  }

  throw lastError ?? new Error('Ошибка сети');
}

/**
 * Create the slide-in panel DOM elements.
 */
export function createPanel(shadow: ShadowRoot): PanelElements {
  const backdrop = document.createElement('div');
  backdrop.className = 'scout-panel-backdrop hidden';

  const panel = document.createElement('div');
  panel.className = 'scout-panel';

  // Header
  const header = document.createElement('div');
  header.className = 'scout-panel-header';

  const title = document.createElement('h2');
  title.textContent = 'Scout — Сообщить о баге';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'scout-panel-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>`;

  header.appendChild(title);
  header.appendChild(closeBtn);

  // User info bar (shows logged-in user + logout button — like Marker.io/Usersnap)
  const userBar = document.createElement('div');
  userBar.className = 'scout-user-bar';

  const userInfo = document.createElement('div');
  userInfo.className = 'scout-user-info';

  const userAvatar = document.createElement('div');
  userAvatar.className = 'scout-user-avatar';

  const userName = document.createElement('span');
  userName.className = 'scout-user-name';

  userInfo.appendChild(userAvatar);
  userInfo.appendChild(userName);

  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'scout-logout-btn';
  logoutBtn.textContent = 'Выйти';
  logoutBtn.setAttribute('aria-label', 'Выйти из аккаунта');

  userBar.appendChild(userInfo);
  userBar.appendChild(logoutBtn);

  // Body
  const body = document.createElement('div');
  body.className = 'scout-panel-body';

  // Element info
  const elementInfo = document.createElement('div');
  elementInfo.className = 'scout-element-info';

  const selectorLabel = document.createElement('div');
  selectorLabel.className = 'scout-element-info-label';
  selectorLabel.textContent = 'Элемент';

  const selectorDisplay = document.createElement('div');
  selectorDisplay.className = 'scout-element-info-value';

  const textLabel = document.createElement('div');
  textLabel.className = 'scout-element-info-label';
  textLabel.textContent = 'Текст';

  const textDisplay = document.createElement('div');
  textDisplay.className = 'scout-element-text';

  elementInfo.appendChild(selectorLabel);
  elementInfo.appendChild(selectorDisplay);
  elementInfo.appendChild(textLabel);
  elementInfo.appendChild(textDisplay);

  // Textarea field
  const field = document.createElement('div');
  field.className = 'scout-field';

  const label = document.createElement('label');
  label.innerHTML = 'Опишите проблему <span class="scout-required">*</span>';

  const textarea = document.createElement('textarea');
  textarea.placeholder = 'Что пошло не так? Что вы ожидали?';
  textarea.setAttribute('minlength', '3');
  textarea.setAttribute('maxlength', '5000');

  const charCount = document.createElement('div');
  charCount.className = 'scout-char-count';
  charCount.textContent = '0 / 5000';

  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    charCount.textContent = `${len} / 5000`;
    if (len >= 3) {
      textarea.classList.remove('error');
    }
  });

  field.appendChild(label);
  field.appendChild(textarea);
  field.appendChild(charCount);

  // Priority selector
  const priorityField = document.createElement('div');
  priorityField.className = 'scout-field';

  const priorityLabel = document.createElement('label');
  priorityLabel.textContent = 'Приоритет';

  const prioritySelect = document.createElement('select');
  prioritySelect.className = 'scout-input';
  prioritySelect.style.padding = '8px 12px';

  const priorityOptions: [string, string][] = [
    ['critical', 'Критический'],
    ['high', 'Высокий'],
    ['medium', 'Средний'],
    ['low', 'Низкий'],
  ];
  for (const [value, text] of priorityOptions) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    if (value === 'medium') opt.selected = true;
    prioritySelect.appendChild(opt);
  }

  priorityField.appendChild(priorityLabel);
  priorityField.appendChild(prioritySelect);

  // Checkboxes
  const screenshotLabel = document.createElement('label');
  screenshotLabel.className = 'scout-checkbox';
  const screenshotCheckbox = document.createElement('input');
  screenshotCheckbox.type = 'checkbox';
  screenshotCheckbox.checked = true;
  screenshotLabel.appendChild(screenshotCheckbox);
  screenshotLabel.appendChild(document.createTextNode('Прикрепить скриншот'));

  const recordingLabel = document.createElement('label');
  recordingLabel.className = 'scout-checkbox';
  const recordingCheckbox = document.createElement('input');
  recordingCheckbox.type = 'checkbox';
  recordingCheckbox.checked = true;
  recordingLabel.appendChild(recordingCheckbox);
  recordingLabel.appendChild(document.createTextNode('Прикрепить запись сессии'));

  // Screenshot preview (professional pattern: show before sending)
  const screenshotPreview = document.createElement('div');
  screenshotPreview.className = 'scout-screenshot-preview hidden';

  // Progress status indicator
  const progressStatus = document.createElement('div');
  progressStatus.className = 'scout-progress-status hidden';

  body.appendChild(elementInfo);
  body.appendChild(field);
  body.appendChild(priorityField);
  body.appendChild(screenshotLabel);
  body.appendChild(recordingLabel);
  body.appendChild(screenshotPreview);
  body.appendChild(progressStatus);

  // Footer
  const footer = document.createElement('div');
  footer.className = 'scout-panel-footer';

  const submitBtn = document.createElement('button');
  submitBtn.className = 'scout-btn scout-btn-primary';
  submitBtn.textContent = 'Отправить';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'scout-btn scout-btn-secondary';
  cancelBtn.textContent = 'Отмена';

  footer.appendChild(submitBtn);
  footer.appendChild(cancelBtn);

  // "Powered by Scout" badge (industry standard — Marker.io, Usersnap, BugHerd, Gleap all have it)
  const poweredBy = document.createElement('div');
  poweredBy.className = 'scout-powered-by';
  poweredBy.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 7v10M7 12h10"/><path d="M8 2l1.5 1.5M16 2l-1.5 1.5"/><path d="M3 10h2M19 10h2"/></svg> Powered by Scout`;

  // Assemble
  panel.appendChild(header);
  panel.appendChild(userBar);
  panel.appendChild(body);
  panel.appendChild(footer);
  panel.appendChild(poweredBy);

  backdrop.appendChild(panel);
  shadow.appendChild(backdrop);

  return {
    backdrop,
    panel,
    selectorDisplay,
    textDisplay,
    textarea,
    charCount,
    prioritySelect,
    screenshotCheckbox,
    recordingCheckbox,
    submitBtn,
    cancelBtn,
    progressStatus,
    screenshotPreview,
  };
}

/**
 * Show the panel with the picked element info.
 */
export function showPanel(
  elements: PanelElements,
  picked: PickedElement,
): void {
  // Update user info (Marker.io/Usersnap pattern: show who's logged in)
  const user = getUser();
  if (user) {
    const initials = (user.name ?? user.email).slice(0, 2).toUpperCase();
    const avatarEl = elements.panel.querySelector('.scout-user-avatar');
    const nameEl = elements.panel.querySelector('.scout-user-name');
    if (avatarEl) avatarEl.textContent = initials;
    if (nameEl) nameEl.textContent = user.name ?? user.email;
  }

  elements.selectorDisplay.textContent = picked.cssSelector;
  elements.textDisplay.textContent = picked.elementText || '(нет текста)';
  elements.textarea.value = '';
  elements.textarea.classList.remove('error');
  elements.charCount.textContent = '0 / 5000';
  elements.prioritySelect.value = 'medium';
  elements.screenshotCheckbox.checked = true;
  elements.submitBtn.disabled = false;
  elements.submitBtn.textContent = 'Отправить';
  elements.cancelBtn.disabled = false;

  // Recording checkbox: only enable if recording is available
  const recAvailable = isRecordingAvailable();
  elements.recordingCheckbox.checked = recAvailable;
  elements.recordingCheckbox.disabled = !recAvailable;

  // Reset preview and progress
  elements.screenshotPreview.classList.add('hidden');
  elements.screenshotPreview.innerHTML = '';
  elements.progressStatus.classList.add('hidden');
  elements.progressStatus.textContent = '';

  elements.backdrop.style.display = '';
  elements.backdrop.classList.remove('hidden');
  void elements.backdrop.offsetHeight;
  elements.backdrop.classList.add('visible');
  elements.panel.classList.add('visible');

  setTimeout(() => elements.textarea.focus(), 300);
}

/**
 * Hide the panel.
 */
export function hidePanel(elements: PanelElements): void {
  elements.panel.classList.remove('visible');
  elements.backdrop.classList.remove('visible');
  setTimeout(() => {
    elements.backdrop.classList.add('hidden');
  }, 250);
}

function setProgress(elements: PanelElements, text: string): void {
  elements.progressStatus.innerHTML = `<span class="scout-spinner scout-spinner-sm"></span>${text}`;
  elements.progressStatus.classList.remove('hidden');
}

function setProgressWarning(elements: PanelElements, text: string): void {
  elements.progressStatus.innerHTML = `<span class="scout-progress-warn">!</span>${text}`;
  elements.progressStatus.classList.remove('hidden');
}

/**
 * Show screenshot preview thumbnail in the panel.
 */
function showScreenshotPreview(elements: PanelElements, base64: string): void {
  elements.screenshotPreview.innerHTML = '';
  const img = document.createElement('img');
  img.src = `data:${SCREENSHOT_MIME};base64,${base64}`;
  img.alt = 'Превью скриншота';
  img.className = 'scout-screenshot-img';
  elements.screenshotPreview.appendChild(img);
  elements.screenshotPreview.classList.remove('hidden');
}

/**
 * Wire up submit and cancel events for the panel.
 */
export function attachPanelEvents(
  elements: PanelElements,
  apiUrl: string,
  projectSlug: string,
  picked: () => PickedElement | null,
  callbacks: PanelCallbacks,
): void {
  elements.cancelBtn.addEventListener('click', () => {
    hidePanel(elements);
    callbacks.onClose();
  });

  const closeBtn = elements.panel.querySelector('.scout-panel-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      hidePanel(elements);
      callbacks.onClose();
    });
  }

  // Logout button
  const logoutBtn = elements.panel.querySelector('.scout-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearAuth();
      resetProjectCache();
      hidePanel(elements);
      callbacks.onLogout();
    });
  }

  elements.submitBtn.addEventListener('click', async () => {
    const p = picked();
    if (!p) return;

    const message = elements.textarea.value.trim();
    if (message.length < 3) {
      elements.textarea.classList.add('error');
      elements.textarea.focus();
      return;
    }

    // Disable controls
    elements.submitBtn.disabled = true;
    elements.cancelBtn.disabled = true;
    elements.submitBtn.innerHTML = '<span class="scout-spinner"></span>Подготовка...';

    const warnings: string[] = [];

    try {
      const token = getToken();
      if (!token) throw new Error('Вы не авторизованы');

      // Step 1: Resolve project
      setProgress(elements, 'Подключение к проекту...');
      const projectId = await resolveProjectId(apiUrl, projectSlug);

      // Step 2: Capture screenshot
      let screenshot: string | undefined;
      if (elements.screenshotCheckbox.checked) {
        setProgress(elements, 'Создание скриншота...');
        elements.submitBtn.innerHTML = '<span class="scout-spinner"></span>Скриншот...';

        elements.backdrop.style.display = 'none';
        const result = await captureScreenshot(p.cssSelector);
        elements.backdrop.style.display = '';

        if (result !== null) {
          screenshot = result;
          // Show preview (professional pattern)
          showScreenshotPreview(elements, result);
        } else {
          warnings.push('Скриншот не удалось создать');
          setProgressWarning(elements, 'Скриншот не удался, продолжаем...');
          await sleep(500);
        }
      }

      // Step 3: Serialize + compress recording (fflate gzip)
      let sessionRecording: string | undefined;
      if (elements.recordingCheckbox.checked) {
        setProgress(elements, 'Сжатие записи сессии...');
        elements.submitBtn.innerHTML = '<span class="scout-spinner"></span>Запись...';

        const result = getRecordingCompressed();
        if (result !== null) {
          sessionRecording = result;
        } else {
          warnings.push('Запись сессии недоступна');
          setProgressWarning(elements, 'Запись не удалась, продолжаем...');
          await sleep(500);
        }
      }

      // Step 4: Send with retry (exponential backoff: 1s, 2s, 4s)
      setProgress(elements, 'Отправка на сервер...');
      elements.submitBtn.innerHTML = '<span class="scout-spinner"></span>Отправка...';

      // Auto-capture environment metadata (Marker.io/Usersnap pattern)
      const metadata = collectMetadata();

      const body = {
        projectId,
        message,
        priority: elements.prioritySelect.value,
        pageUrl: p.pageUrl,
        cssSelector: p.cssSelector,
        elementText: p.elementText,
        elementHtml: p.elementHtml,
        viewportWidth: p.viewportWidth,
        viewportHeight: p.viewportHeight,
        screenshot,
        sessionRecording,
        metadata,
      };

      const res = await fetchWithRetry(
        `${apiUrl}/api/items/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        },
        (attempt, max) => {
          setProgress(elements, `Повторная отправка (${attempt}/${max})...`);
        },
      );

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error ?? errBody?.message ?? `Ошибка отправки (${res.status})`);
      }

      // Success
      resetBuffer();
      hidePanel(elements);

      if (warnings.length > 0) {
        callbacks.onSubmitSuccess();
        setTimeout(() => {
          callbacks.onSubmitError(warnings.join('. '));
        }, 3500);
      } else {
        callbacks.onSubmitSuccess();
      }
    } catch (err: unknown) {
      elements.backdrop.style.display = '';
      const msg = err instanceof Error ? err.message : 'Неизвестная ошибка';
      elements.submitBtn.disabled = false;
      elements.cancelBtn.disabled = false;
      elements.submitBtn.textContent = 'Отправить';
      elements.progressStatus.classList.add('hidden');
      callbacks.onSubmitError(msg);
    }
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
