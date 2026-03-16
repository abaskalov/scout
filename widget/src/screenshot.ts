import html2canvas from 'html2canvas';

/**
 * Capture a screenshot of the current page using html2canvas.
 * If a CSS selector is provided, highlights the selected element with a red outline.
 *
 * Returns a base64-encoded PNG string (without the data:image/png;base64, prefix).
 */
export async function captureScreenshot(highlightSelector?: string): Promise<string> {
  // Hide the widget root so it doesn't appear in the screenshot
  const widgetRoot = document.getElementById('scout-widget-root');
  let prevDisplay = '';
  if (widgetRoot) {
    prevDisplay = widgetRoot.style.display;
    widgetRoot.style.display = 'none';
  }

  // Add highlight overlay on selected element
  let highlightOverlay: HTMLDivElement | null = null;
  if (highlightSelector) {
    try {
      const el = document.querySelector(highlightSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        highlightOverlay = document.createElement('div');
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
    const canvas = await html2canvas(document.body, {
      useCORS: true,
      allowTaint: true,
      scale: 1,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.replace(/^data:image\/png;base64,/, '');
  } finally {
    // Clean up highlight overlay
    if (highlightOverlay) {
      highlightOverlay.remove();
    }
    if (widgetRoot) {
      widgetRoot.style.display = prevDisplay;
    }
  }
}
