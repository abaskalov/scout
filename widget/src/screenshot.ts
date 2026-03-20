import { domToJpeg } from 'modern-screenshot';

/**
 * Screenshot capture using modern-screenshot (SVG foreignObject).
 *
 * Unlike html2canvas which re-implements CSS rendering on canvas,
 * modern-screenshot uses SVG foreignObject — the browser itself renders
 * the DOM natively. This means oklch, color-mix, grid, flexbox, and all
 * modern CSS features work out of the box.
 *
 * Returns base64-encoded JPEG string (without data: prefix), or null on failure.
 */

const JPEG_QUALITY = 0.85;
const SCREENSHOT_TIMEOUT_MS = 10_000;

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
    const dataUrl = await Promise.race([
      domToJpeg(document.documentElement, {
        quality: JPEG_QUALITY,
        scale: 1,
        filter: (node: Node) => {
          if (node instanceof HTMLElement && node.id === 'scout-widget-root') return false;
          return true;
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Screenshot timeout')), SCREENSHOT_TIMEOUT_MS),
      ),
    ]);

    if (!dataUrl) return null;
    return dataUrl.replace(/^data:image\/jpeg;base64,/, '');
  } catch (err) {
    console.warn('[Scout] Screenshot capture failed:', err);
    return null;
  } finally {
    if (highlightOverlay) highlightOverlay.remove();
  }
}

export const SCREENSHOT_MIME = 'image/jpeg';
