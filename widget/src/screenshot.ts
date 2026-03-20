import html2canvas from 'html2canvas';

/**
 * Capture a screenshot using html2canvas with oklch/modern CSS safety patches.
 *
 * html2canvas v1.4 crashes on oklch/oklab/color-mix CSS functions (Tailwind 4).
 * We patch its internal color parser to return transparent instead of throwing.
 * The onclone hook then resolves real colors via getComputedStyle.
 *
 * Returns base64-encoded JPEG string (without data: prefix), or null on failure.
 */

const SCREENSHOT_TIMEOUT_DESKTOP_MS = 10_000;
const SCREENSHOT_TIMEOUT_IOS_MS = 8_000;
const JPEG_QUALITY = 0.85;

/**
 * Wrap getComputedStyle to intercept oklch/oklab values before html2canvas sees them.
 * html2canvas calls getComputedStyle internally — we proxy it to replace unsupported
 * color functions with browser-resolved rgb() equivalents.
 */
let gcsOriginal: typeof window.getComputedStyle | null = null;
let gcsResolveCache: Map<string, string> | null = null;

/** Install getComputedStyle proxy that converts oklch→rgb before html2canvas sees them */
function installComputedStyleProxy(): void {
  if (gcsOriginal) return; // already installed
  gcsOriginal = window.getComputedStyle;
  gcsResolveCache = new Map();
  const original = gcsOriginal;
  const cache = gcsResolveCache;

  window.getComputedStyle = function (el: Element, pseudo?: string | null): CSSStyleDeclaration {
    const cs = original.call(window, el, pseudo);
    return new Proxy(cs, {
      get(target, prop) {
        if (prop === 'getPropertyValue') {
          return function (name: string): string {
            const val = target.getPropertyValue(name);
            if (val && hasUnsupportedColor(val)) {
              const key = name + ':' + val;
              let resolved = cache.get(key);
              if (!resolved) { resolved = resolveColor(val, name); cache.set(key, resolved); }
              return resolved;
            }
            return val;
          };
        }
        const value = Reflect.get(target, prop);
        if (typeof value === 'function') return value.bind(target);
        if (typeof prop === 'string' && typeof value === 'string' && hasUnsupportedColor(value)) {
          return resolveColor(value, prop);
        }
        return value;
      },
    });
  } as typeof window.getComputedStyle;
}

/** Restore original getComputedStyle */
function uninstallComputedStyleProxy(): void {
  if (gcsOriginal) {
    window.getComputedStyle = gcsOriginal;
    gcsOriginal = null;
    gcsResolveCache = null;
  }
}

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
  if (/^color$|^-webkit-text|^caret/.test(prop)) return '#000';
  if (/border|outline|column-rule/.test(prop)) return '#ccc';
  if (/shadow/.test(prop)) return 'none';
  return 'transparent';
}

/**
 * Resolve oklch/oklab CSS values to rgb using the browser's own CSS engine.
 * Uses a persistent off-screen element to avoid DOM thrashing.
 * Falls back to property-aware default if resolution fails.
 */
let resolveEl: HTMLSpanElement | null = null;

function resolveColor(value: string, prop: string): string {
  try {
    if (!resolveEl) {
      resolveEl = document.createElement('span');
      resolveEl.style.cssText = 'position:fixed;top:-9999px;left:-9999px;pointer-events:none;visibility:hidden';
      document.body.appendChild(resolveEl);
    }
    resolveEl.style.color = '';
    resolveEl.style.color = value;
    const resolved = getComputedStyle(resolveEl).color;
    if (resolved && resolved !== '' && !hasUnsupportedColor(resolved)) {
      return resolved;
    }
  } catch { /* resolution failed */ }
  return fallbackForProp(prop);
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
/** Check if a string contains any unsupported color functions */
function hasUnsupportedColor(css: string): boolean {
  const lower = css.toLowerCase();
  return UNSUPPORTED_FNS.some((fn) => lower.includes(fn + '('));
}

function sanitizeUnsupportedColors(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node: Node | null = walker.currentNode;

  while (node) {
    if (node instanceof HTMLElement) {
      const style = node.style;
      for (let i = 0; i < style.length; i++) {
        const prop = style[i]!;
        const val = style.getPropertyValue(prop);
        if (hasUnsupportedColor(val)) {
          // Try to resolve via browser's CSS engine (preserves actual color)
          const resolved = resolveColor(val, prop);
          style.setProperty(prop, resolved);
        }
      }
      // Sanitize CSS custom properties (--tw-*, etc.) that store oklch values
      // Read from inline style only (not computed — clone may not be in DOM yet)
      for (let ci = 0; ci < style.length; ci++) {
        const cprop = style[ci]!;
        if (cprop.startsWith('--')) {
          const cval = style.getPropertyValue(cprop);
          if (cval && hasUnsupportedColor(cval)) {
            style.setProperty(cprop, replaceUnsupportedColors(cval, 'transparent'));
          }
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
      if (hasUnsupportedColor(text)) {
        styleEl.textContent = replaceUnsupportedColors(text, 'transparent');
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
    // Proxy getComputedStyle to convert oklch→rgb before html2canvas parser sees them.
    // html2canvas reads computed styles internally and crashes on oklch().
    installComputedStyleProxy();

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

    // Strategy 1: useCORS (clean canvas, exportable)
    // Strategy 2: allowTaint (renders all images but canvas may be tainted)
    for (const strategy of [
      { useCORS: true, allowTaint: false },
      { useCORS: false, allowTaint: true },
    ]) {
      try {
        // Fresh timeout per strategy — so second attempt gets full time budget
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Screenshot timeout')), SCREENSHOT_TIMEOUT_MS),
        );
        const canvas = await Promise.race([
          html2canvas(document.documentElement, { ...baseOpts, ...strategy }),
          timeout,
        ]);
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        if (resolveEl) { resolveEl.remove(); resolveEl = null; }
        return dataUrl.replace(/^data:image\/jpeg;base64,/, '');
      } catch (err) {
        console.warn('[Scout] Strategy failed:', strategy, err);
      }
    }

    console.warn('[Scout] All screenshot strategies failed');
    // Cleanup resolve helper
    if (resolveEl) { resolveEl.remove(); resolveEl = null; }
    return null;
  } catch (err) {
    console.warn('[Scout] Screenshot capture failed:', err);
    return null;
  } finally {
    uninstallComputedStyleProxy();
    if (resolveEl) { resolveEl.remove(); resolveEl = null; }
    if (highlightOverlay) highlightOverlay.remove();
  }
}

/**
 * Get the MIME type used for screenshots.
 * Used by panel to set correct content type.
 */
export const SCREENSHOT_MIME = 'image/jpeg';
