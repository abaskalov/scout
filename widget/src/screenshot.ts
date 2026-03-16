import html2canvas from 'html2canvas';

/**
 * Capture a screenshot of the current page using html2canvas.
 * html2canvas operates on the real DOM (not Shadow DOM), so we call it
 * on document.body directly.
 *
 * Returns a base64-encoded PNG string (without the data:image/png;base64, prefix).
 */
export async function captureScreenshot(): Promise<string> {
  // Hide the widget root so it doesn't appear in the screenshot
  const widgetRoot = document.getElementById('scout-widget-root');
  let prevDisplay = '';
  if (widgetRoot) {
    prevDisplay = widgetRoot.style.display;
    widgetRoot.style.display = 'none';
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
    // Strip the prefix "data:image/png;base64,"
    return dataUrl.replace(/^data:image\/png;base64,/, '');
  } finally {
    if (widgetRoot) {
      widgetRoot.style.display = prevDisplay;
    }
  }
}
