import html2canvas from 'html2canvas';
import { t } from './i18n';

/**
 * Screenshot capture with two strategies:
 * 1. getDisplayMedia (Screen Capture API) — pixel-perfect, requires user permission
 * 2. html2canvas fallback — approximate rendering, no permission needed
 *
 * Returns base64-encoded JPEG string (without data: prefix), or null on failure.
 */

const JPEG_QUALITY = 0.85;
const HTML2CANVAS_TIMEOUT_MS = 10_000;

/** Detect iOS (no getDisplayMedia support) */
function isIOS(): boolean {
  const ua = navigator?.userAgent ?? '';
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  if (/Macintosh/i.test(ua) && navigator?.maxTouchPoints > 1) return true;
  return false;
}

// ============================================================
// Strategy 1: getDisplayMedia — pixel-perfect native capture
// ============================================================

async function captureNative(): Promise<string | null> {
  // Not supported on iOS or in insecure contexts
  if (isIOS() || !navigator.mediaDevices?.getDisplayMedia) return null;

  let stream: MediaStream | null = null;

  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser' } as MediaTrackConstraints,
      audio: false,
      // @ts-expect-error — preferCurrentTab is supported in Chrome 94+
      preferCurrentTab: true,
    });

    const track = stream.getVideoTracks()[0];
    if (!track) return null;

    // Capture frame from video track
    // @ts-expect-error — ImageCapture is available in Chrome 59+
    if (typeof ImageCapture !== 'undefined') {
      // @ts-expect-error
      const capture = new ImageCapture(track);
      const bitmap = await capture.grabFrame();

      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();

      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      return dataUrl.replace(/^data:image\/jpeg;base64,/, '');
    }

    // Fallback: use video element to grab frame
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;

    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => { video.play(); resolve(); };
    });
    // Wait one frame for the video to render
    await new Promise((r) => requestAnimationFrame(r));

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);
    video.pause();
    video.srcObject = null;

    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    return dataUrl.replace(/^data:image\/jpeg;base64,/, '');
  } catch {
    // User denied permission or API not available
    return null;
  } finally {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
  }
}

// ============================================================
// Strategy 2: html2canvas fallback
// ============================================================

/** CSS color functions unsupported by html2canvas v1.4 */
const UNSUPPORTED_FNS = ['oklch', 'oklab', 'lab', 'lch', 'color-mix', 'light-dark'];

function replaceColorFn(css: string, fnName: string, replacement: string): string {
  let result = '';
  let i = 0;
  const lower = css.toLowerCase();
  while (i < css.length) {
    const idx = lower.indexOf(fnName + '(', i);
    if (idx === -1) { result += css.slice(i); break; }
    result += css.slice(i, idx);
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
        if (replaced !== val) style.setProperty(prop, replaced);
      }
    }
    node = walker.nextNode();
  }
  const doc = root.ownerDocument;
  if (doc) {
    doc.querySelectorAll('style').forEach((styleEl) => {
      const text = styleEl.textContent ?? '';
      const replaced = replaceUnsupportedColors(text, 'transparent');
      if (replaced !== text) styleEl.textContent = replaced;
    });
  }
}

async function captureHtml2Canvas(): Promise<string | null> {
  const ios = isIOS();
  const w = ios ? window.innerWidth : Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, window.innerWidth);
  const h = ios ? window.innerHeight : Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, window.innerHeight);
  const sx = ios ? window.scrollX : 0;
  const sy = ios ? window.scrollY : 0;

  const baseOpts = {
    width: w, height: h, windowWidth: w, windowHeight: h,
    scrollX: ios ? -sx : 0, scrollY: ios ? -sy : 0,
    x: ios ? sx : 0, y: ios ? sy : 0,
    scale: 1, backgroundColor: '#ffffff',
    ignoreElements: (el: Element) => el.id === 'scout-widget-root',
    logging: false,
    onclone: (_doc: Document, clone: HTMLElement) => sanitizeUnsupportedColors(clone),
  };

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Screenshot timeout')), HTML2CANVAS_TIMEOUT_MS),
  );

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
    } catch {
      // Strategy failed — try next
    }
  }

  return null;
}

// ============================================================
// Public API
// ============================================================

/**
 * Capture screenshot. Tries native Screen Capture API first (pixel-perfect),
 * falls back to html2canvas (approximate but no permission needed).
 * Optionally highlights a picked element with red border.
 */
export async function captureScreenshot(highlightSelector?: string): Promise<string | null> {
  let highlightOverlay: HTMLDivElement | null = null;

  if (highlightSelector) {
    try {
      const el = document.querySelector(highlightSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        highlightOverlay = document.createElement('div');
        highlightOverlay.setAttribute('data-scout-highlight', 'true');
        highlightOverlay.style.cssText = `
          position: fixed;
          top: ${rect.top - 3}px;
          left: ${rect.left - 3}px;
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
    // Strategy 1: Native screen capture (pixel-perfect)
    const native = await captureNative();
    if (native) return native;

    // Strategy 2: html2canvas fallback (approximate)
    return await captureHtml2Canvas();
  } finally {
    if (highlightOverlay) highlightOverlay.remove();
  }
}

export const SCREENSHOT_MIME = 'image/jpeg';
