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
const SCREENSHOT_TIMEOUT_IOS_MS = 5_000;
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
    const fullWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
      window.innerWidth,
    );
    const fullHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      window.innerHeight,
    );

    // Capture with timeout (prevents hanging on complex pages)
    const canvas = await Promise.race([
      html2canvas(document.documentElement, {
        width: fullWidth,
        height: fullHeight,
        windowWidth: fullWidth,
        windowHeight: fullHeight,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        scale: 1,
        backgroundColor: '#ffffff',
        ignoreElements: (element: Element) => {
          return element.id === 'scout-widget-root';
        },
        useCORS: true,
        allowTaint: false,
        logging: false,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Screenshot timeout')), SCREENSHOT_TIMEOUT_MS),
      ),
    ]);

    // JPEG instead of PNG — 3-5x smaller payload (professional tools pattern)
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    return dataUrl.replace(/^data:image\/jpeg;base64,/, '');
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
