import type { PickedElement } from './element-picker';
import { captureScreenshot } from './screenshot';
import { getRecordingBase64, resetBuffer } from './recorder';
import { getToken, resolveProjectId } from './auth';

interface PanelElements {
  backdrop: HTMLDivElement;
  panel: HTMLDivElement;
  selectorDisplay: HTMLDivElement;
  textDisplay: HTMLDivElement;
  textarea: HTMLTextAreaElement;
  charCount: HTMLSpanElement;
  screenshotCheckbox: HTMLInputElement;
  recordingCheckbox: HTMLInputElement;
  submitBtn: HTMLButtonElement;
  cancelBtn: HTMLButtonElement;
}

export interface PanelCallbacks {
  onClose: () => void;
  onSubmitSuccess: () => void;
  onSubmitError: (msg: string) => void;
}

/**
 * Create the slide-in panel DOM elements. Returns an object with references
 * to all interactive parts.
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

  body.appendChild(elementInfo);
  body.appendChild(field);
  body.appendChild(screenshotLabel);
  body.appendChild(recordingLabel);

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

  // Assemble
  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(footer);

  backdrop.appendChild(panel);
  shadow.appendChild(backdrop);

  return {
    backdrop,
    panel,
    selectorDisplay,
    textDisplay,
    textarea,
    charCount,
    screenshotCheckbox,
    recordingCheckbox,
    submitBtn,
    cancelBtn,
  };
}

/**
 * Show the panel with the picked element info.
 */
export function showPanel(
  elements: PanelElements,
  picked: PickedElement,
): void {
  elements.selectorDisplay.textContent = picked.cssSelector;
  elements.textDisplay.textContent = picked.elementText || '(нет текста)';
  elements.textarea.value = '';
  elements.textarea.classList.remove('error');
  elements.charCount.textContent = '0 / 5000';
  elements.screenshotCheckbox.checked = true;
  elements.recordingCheckbox.checked = true;
  elements.submitBtn.disabled = false;
  elements.submitBtn.textContent = 'Отправить';

  elements.backdrop.classList.remove('hidden');
  // Trigger reflow for transition
  void elements.backdrop.offsetHeight;
  elements.backdrop.classList.add('visible');
  elements.panel.classList.add('visible');

  // Focus textarea
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

  // Close button in header
  const closeBtn = elements.panel.querySelector('.scout-panel-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      hidePanel(elements);
      callbacks.onClose();
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

    elements.submitBtn.disabled = true;
    elements.submitBtn.innerHTML = '<span class="scout-spinner"></span>Отправка...';

    try {
      const token = getToken();
      if (!token) throw new Error('Вы не авторизованы');

      const projectId = await resolveProjectId(apiUrl, projectSlug);

      // Collect optional data
      let screenshot: string | undefined;
      if (elements.screenshotCheckbox.checked) {
        // Hide panel temporarily for screenshot
        elements.backdrop.style.display = 'none';
        try {
          screenshot = await captureScreenshot();
        } finally {
          elements.backdrop.style.display = '';
        }
      }

      let sessionRecording: string | undefined;
      if (elements.recordingCheckbox.checked) {
        sessionRecording = getRecordingBase64();
      }

      const body = {
        projectId,
        message,
        pageUrl: p.pageUrl,
        cssSelector: p.cssSelector,
        elementText: p.elementText,
        elementHtml: p.elementHtml,
        viewportWidth: p.viewportWidth,
        viewportHeight: p.viewportHeight,
        screenshot,
        sessionRecording,
      };

      const res = await fetch(`${apiUrl}/api/items/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error ?? errBody?.message ?? `Ошибка отправки (${res.status})`);
      }

      // Success
      resetBuffer();
      hidePanel(elements);
      callbacks.onSubmitSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Неизвестная ошибка';
      elements.submitBtn.disabled = false;
      elements.submitBtn.textContent = 'Отправить';
      callbacks.onSubmitError(msg);
    }
  });
}
