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
 * Hovering (or touch-moving) highlights elements. Clicking/tapping captures
 * element info and resolves the promise.
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

    function resolveElementAt(x: number, y: number): Element | null {
      overlay.style.pointerEvents = 'none';
      const el = document.elementFromPoint(x, y);
      overlay.style.pointerEvents = '';

      if (!el || el.id === 'scout-widget-root' || el.closest('#scout-widget-root')) {
        return null;
      }
      return el;
    }

    function onMouseMove(e: MouseEvent): void {
      const el = resolveElementAt(e.clientX, e.clientY);

      if (!el) {
        highlight.classList.add('hidden');
        currentTarget = null;
        return;
      }

      currentTarget = el;
      updateHighlight(el);
    }

    function onTouchMove(e: TouchEvent): void {
      e.preventDefault(); // Prevent scrolling while picking
      const touch = e.touches[0];
      if (!touch) return;

      const el = resolveElementAt(touch.clientX, touch.clientY);

      if (!el) {
        highlight.classList.add('hidden');
        currentTarget = null;
        return;
      }

      currentTarget = el;
      updateHighlight(el);
    }

    function onTouchStart(e: TouchEvent): void {
      e.preventDefault(); // Prevent scrolling
      const touch = e.touches[0];
      if (!touch) return;

      const el = resolveElementAt(touch.clientX, touch.clientY);

      if (!el) {
        highlight.classList.add('hidden');
        currentTarget = null;
        return;
      }

      currentTarget = el;
      updateHighlight(el);
    }

    function finishPick(): void {
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

    function onClick(e: MouseEvent): void {
      e.preventDefault();
      e.stopPropagation();
      finishPick();
    }

    function onTouchEnd(e: TouchEvent): void {
      e.preventDefault();
      e.stopPropagation();
      finishPick();
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
      overlay.removeEventListener('touchstart', onTouchStart);
      overlay.removeEventListener('touchmove', onTouchMove);
      overlay.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('keydown', onKeyDown, true);
    }

    overlay.addEventListener('mousemove', onMouseMove);
    overlay.addEventListener('click', onClick);
    overlay.addEventListener('touchstart', onTouchStart, { passive: false });
    overlay.addEventListener('touchmove', onTouchMove, { passive: false });
    overlay.addEventListener('touchend', onTouchEnd, { passive: false });
    document.addEventListener('keydown', onKeyDown, true);
  });
}
