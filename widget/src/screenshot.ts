import { domToPng } from 'modern-screenshot';

/**
 * Capture a full-page screenshot using modern-screenshot (SVG foreignObject).
 * If a CSS selector is provided, highlights the selected element with a red outline.
 *
 * Returns a base64-encoded PNG string (without the data:image/png;base64, prefix).
 */
export async function captureScreenshot(highlightSelector?: string): Promise<string> {
  // Add highlight on selected element using ABSOLUTE positioning
  let highlightOverlay: HTMLDivElement | null = null;
  if (highlightSelector) {
    try {
      const el = document.querySelector(highlightSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        const absTop = rect.top + window.scrollY;
        const absLeft = rect.left + window.scrollX;

        highlightOverlay = document.createElement('div');
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

    const dataUrl = await domToPng(document.documentElement, {
      width: fullWidth,
      height: fullHeight,
      scale: 1,
      backgroundColor: '#ffffff',
      timeout: 8_000,
      // Exclude the Scout widget from the screenshot
      filter: (node: Node) => {
        if (node instanceof Element && node.id === 'scout-widget-root') return false;
        return true;
      },
      features: {
        // Render from document top, not from current scroll position
        restoreScrollPosition: false,
        // Safari/Firefox SVG decode fix (enabled by default, explicit for clarity)
        fixSvgXmlDecode: true,
      },
      // Safari/Firefox draw-image decode fix
      drawImageInterval: 100,
    });

    return dataUrl.replace(/^data:image\/png;base64,/, '');
  } finally {
    if (highlightOverlay) {
      highlightOverlay.remove();
    }
  }
}
