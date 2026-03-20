import html2canvas from 'html2canvas';

/**
 * Capture a full-page screenshot using html2canvas.
 *
 * html2canvas renders the DOM to <canvas> by parsing CSS and drawing directly —
 * NO SVG foreignObject (unlike modern-screenshot / html-to-image).
 * This makes it the most cross-browser-compatible DOM screenshot solution.
 *
 * Professional improvements applied:
 * - JPEG format instead of PNG (3-5x smaller payload)
 * - Timeout via Promise.race (prevents hanging on complex pages)
 * - useCORS for cross-origin images (best-effort)
 * - Graceful degradation (returns null on failure)
 *
 * Returns base64-encoded JPEG string (without data: prefix), or null on failure.
 */

const SCREENSHOT_TIMEOUT_DESKTOP_MS = 10_000;
const SCREENSHOT_TIMEOUT_IOS_MS = 8_000;
const JPEG_QUALITY = 0.85;

/** Detect iOS Safari (iPhone, iPad, iPod — including iPad with desktop UA) */
function isIOSSafari(): boolean {
  const ua = navigator?.userAgent ?? '';
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPad with desktop UA (iPadOS 13+)
  if (/Macintosh/i.test(ua) && navigator?.maxTouchPoints > 1) return true;
  return false;
}

const SCREENSHOT_TIMEOUT_MS = isIOSSafari() ? SCREENSHOT_TIMEOUT_IOS_MS : SCREENSHOT_TIMEOUT_DESKTOP_MS;

/**
 * Match balanced parentheses for a CSS function call.
 * Handles nested parens: oklch(0.5 0.2 calc(180 + 30))
 */
function replaceColorFn(css: string, fnName: string, replacement: string): string {
  let result = '';
  let i = 0;
  const lower = css.toLowerCase();
  while (i < css.length) {
    const idx = lower.indexOf(fnName + '(', i);
    if (idx === -1) { result += css.slice(i); break; }
    result += css.slice(i, idx);
    // Find matching closing paren
    let depth = 0;
    let j = idx + fnName.length;
    for (; j < css.length; j++) {
      if (css[j] === '(') depth++;
      else if (css[j] === ')') { depth--; if (depth === 0) { j++; break; } }
    }
    result += replacement;
    i = j;
  }
  return result;
}

/** CSS color functions unsupported by html2canvas v1.4 */
const UNSUPPORTED_FNS = ['oklch', 'oklab', 'lab', 'lch', 'color-mix', 'light-dark'];

/** Property-aware fallback: text→black, background→transparent, border→gray */
function fallbackForProp(prop: string): string {
  if (/^color$|^-webkit-text/.test(prop)) return '#000';
  if (/border|outline/.test(prop)) return '#ccc';
  if (/shadow/.test(prop)) return 'none';
  return 'transparent';
}

function replaceUnsupportedColors(css: string, fallback: string): string {
  let result = css;
  for (const fn of UNSUPPORTED_FNS) {
    result = replaceColorFn(result, fn, fallback);
  }
  return result;
}

/**
 * Sanitize unsupported CSS color functions in the cloned DOM.
 * html2canvas v1.4 crashes on oklch/oklab/color-mix used by Tailwind 4.
 * CSS custom properties (--var) store literal oklch() values that survive getComputedStyle.
 */
function sanitizeUnsupportedColors(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node: Node | null = walker.currentNode;

  while (node) {
    if (node instanceof HTMLElement) {
      const style = node.style;
      for (let i = 0; i < style.length; i++) {
        const prop = style[i]!;
        const val = style.getPropertyValue(prop);
        const replaced = replaceUnsupportedColors(val, fallbackForProp(prop));
        if (replaced !== val) {
          style.setProperty(prop, replaced);
        }
      }
    }
    node = walker.nextNode();
  }

  // Sanitize <style> tags in the cloned document
  const doc = root.ownerDocument;
  if (doc) {
    doc.querySelectorAll('style').forEach((styleEl) => {
      const text = styleEl.textContent ?? '';
      const replaced = replaceUnsupportedColors(text, 'transparent');
      if (replaced !== text) {
        styleEl.textContent = replaced;
      }
    });
  }
}

export async function captureScreenshot(highlightSelector?: string): Promise<string | null> {
  let highlightOverlay: HTMLDivElement | null = null;

  if (highlightSelector) {
    try {
      const el = document.querySelector(highlightSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        const absTop = rect.top + window.scrollY;
        const absLeft = rect.left + window.scrollX;

        highlightOverlay = document.createElement('div');
        highlightOverlay.setAttribute('data-scout-highlight', 'true');
        highlightOverlay.style.cssText = `
          position: absolute;
          top: ${absTop - 3}px;
          left: ${absLeft - 3}px;
          width: ${rect.width + 6}px;
          height: ${rect.height + 6}px;
          border: 3px solid #ef4444;
          border-radius: 4px;
          background: rgba(239, 68, 68, 0.08);
          pointer-events: none;
          z-index: 999998;
          box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.3);
        `;
        document.body.appendChild(highlightOverlay);
      }
    } catch {
      // Invalid selector — skip highlighting
    }
  }

  try {
    const ios = isIOSSafari();

    // iOS Safari: capture viewport only (full-page creates huge canvas that crashes)
    // Desktop: capture full page
    const captureWidth = ios
      ? window.innerWidth
      : Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, window.innerWidth);
    const captureHeight = ios
      ? window.innerHeight
      : Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, window.innerHeight);

    // On iOS, capture from current scroll position (viewport)
    const scrollX = ios ? window.scrollX : 0;
    const scrollY = ios ? window.scrollY : 0;

    const baseOpts = {
      width: captureWidth,
      height: captureHeight,
      windowWidth: captureWidth,
      windowHeight: captureHeight,
      scrollX: ios ? -scrollX : 0,
      scrollY: ios ? -scrollY : 0,
      x: ios ? scrollX : 0,
      y: ios ? scrollY : 0,
      scale: 1,
      backgroundColor: '#ffffff',
      ignoreElements: (element: Element) => element.id === 'scout-widget-root',
      logging: false,
      // html2canvas v1 doesn't support oklch/oklab/lab/lch color functions.
      // Replace them with fallback colors in the cloned DOM before rendering.
      onclone: (_doc: Document, clone: HTMLElement) => {
        sanitizeUnsupportedColors(clone);
      },
    };

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Screenshot timeout')), SCREENSHOT_TIMEOUT_MS),
    );

    // Strategy 1: useCORS (clean canvas, exportable)
    // Strategy 2: allowTaint (renders all images but canvas may be tainted)
    for (const strategy of [
      { useCORS: true, allowTaint: false },
      { useCORS: false, allowTaint: true },
    ]) {
      try {
        const canvas = await Promise.race([
          html2canvas(document.documentElement, { ...baseOpts, ...strategy }),
          timeout,
        ]);
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        return dataUrl.replace(/^data:image\/jpeg;base64,/, '');
      } catch (err) {
        console.warn('[Scout] Screenshot strategy failed:', strategy, err);
        // Strategy failed — try next
      }
    }

    console.warn('[Scout] All screenshot strategies failed');
    return null;
  } catch (err) {
    console.warn('[Scout] Screenshot capture failed:', err);
    return null;
  } finally {
    if (highlightOverlay) {
      highlightOverlay.remove();
    }
  }
}

/**
 * Get the MIME type used for screenshots.
 * Used by panel to set correct content type.
 */
export const SCREENSHOT_MIME = 'image/jpeg';
