import { generateSelector } from './selector';

export interface PickedElement {
  cssSelector: string;
  elementText: string;
  elementHtml: string;
  pageUrl: string;
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * Activate the element picker. Shows an overlay with a crosshair cursor.
 * Hovering highlights elements. Clicking captures element info and resolves the promise.
 * ESC key cancels (resolves with null).
 */
export function pickElement(
  shadow: ShadowRoot,
  overlay: HTMLDivElement,
  highlight: HTMLDivElement,
): Promise<PickedElement | null> {
  return new Promise((resolve) => {
    overlay.classList.remove('hidden');
    highlight.classList.add('hidden');

    let currentTarget: Element | null = null;

    function updateHighlight(el: Element): void {
      const rect = el.getBoundingClientRect();
      highlight.style.top = `${rect.top}px`;
      highlight.style.left = `${rect.left}px`;
      highlight.style.width = `${rect.width}px`;
      highlight.style.height = `${rect.height}px`;
      highlight.classList.remove('hidden');
    }

    function onMouseMove(e: MouseEvent): void {
      // Get element under cursor from the real DOM (not shadow DOM)
      // We need to temporarily hide the overlay to get the element beneath
      overlay.style.pointerEvents = 'none';
      const el = document.elementFromPoint(e.clientX, e.clientY);
      overlay.style.pointerEvents = '';

      if (!el || el.id === 'scout-widget-root' || el.closest('#scout-widget-root')) {
        highlight.classList.add('hidden');
        currentTarget = null;
        return;
      }

      currentTarget = el;
      updateHighlight(el);
    }

    function onClick(e: MouseEvent): void {
      e.preventDefault();
      e.stopPropagation();

      if (!currentTarget) {
        cleanup();
        resolve(null);
        return;
      }

      const el = currentTarget;
      const result: PickedElement = {
        cssSelector: generateSelector(el),
        elementText: (el.textContent ?? '').trim().slice(0, 500),
        elementHtml: el.outerHTML.slice(0, 2000),
        pageUrl: window.location.href,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };

      cleanup();
      resolve(result);
    }

    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault();
        cleanup();
        resolve(null);
      }
    }

    function cleanup(): void {
      overlay.classList.add('hidden');
      highlight.classList.add('hidden');
      overlay.removeEventListener('mousemove', onMouseMove);
      overlay.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeyDown, true);
    }

    overlay.addEventListener('mousemove', onMouseMove);
    overlay.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeyDown, true);
  });
}
