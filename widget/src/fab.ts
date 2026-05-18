import { t } from './i18n';

type FabCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const FAB_CORNER_KEY = 'scout:floating-button-corner';
const DRAG_THRESHOLD_PX = 6;

function getStoredCorner(): FabCorner {
  try {
    const stored = window.localStorage.getItem(FAB_CORNER_KEY);
    if (
      stored === 'top-left' ||
      stored === 'top-right' ||
      stored === 'bottom-left' ||
      stored === 'bottom-right'
    ) {
      return stored;
    }
  } catch {
    // Storage may be unavailable in restricted embeds.
  }

  return 'bottom-right';
}

function storeCorner(corner: FabCorner): void {
  try {
    window.localStorage.setItem(FAB_CORNER_KEY, corner);
  } catch {
    // Ignore storage failures; dragging still works for the current page.
  }
}

function applyCorner(btn: HTMLButtonElement, corner: FabCorner): void {
  btn.dataset.corner = corner;
  btn.style.top = corner.startsWith('top') ? 'calc(20px + var(--safe-top))' : '';
  btn.style.bottom = corner.startsWith('bottom') ? 'calc(20px + var(--safe-bottom))' : '';
  btn.style.left = corner.endsWith('left') ? 'calc(20px + var(--safe-left))' : '';
  btn.style.right = corner.endsWith('right') ? 'calc(20px + var(--safe-right))' : '';
}

function getNearestCorner(btn: HTMLButtonElement): FabCorner {
  const rect = btn.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const vertical = centerY < window.innerHeight / 2 ? 'top' : 'bottom';
  const horizontal = centerX < window.innerWidth / 2 ? 'left' : 'right';

  return `${vertical}-${horizontal}` as FabCorner;
}

/**
 * Create the floating action button element.
 * Uses an SVG bug icon.
 */
export function createFab(onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'scout-fab';
  btn.setAttribute('aria-label', t('fab.label'));
  btn.title = t('fab.label');
  applyCorner(btn, getStoredCorner());

  // Bug/report icon (simplified)
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 2l1.5 1.5M16 2l-1.5 1.5"/>
      <path d="M3 10h2M19 10h2M3 14h2M19 14h2"/>
      <circle cx="12" cy="12" r="5"/>
      <path d="M12 7v10M7 12h10"/>
    </svg>
  `;

  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  let wasDragged = false;
  let suppressNextClick = false;

  btn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;

    const rect = btn.getBoundingClientRect();
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    wasDragged = false;
    btn.setPointerCapture(e.pointerId);
  });

  btn.addEventListener('pointermove', (e) => {
    if (pointerId !== e.pointerId) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    if (!wasDragged && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) return;

    wasDragged = true;
    btn.classList.add('dragging');
    btn.style.left = `${startLeft + deltaX}px`;
    btn.style.top = `${startTop + deltaY}px`;
    btn.style.right = '';
    btn.style.bottom = '';
    e.preventDefault();
  });

  btn.addEventListener('pointerup', (e) => {
    if (pointerId !== e.pointerId) return;

    pointerId = null;
    btn.releasePointerCapture(e.pointerId);
    btn.classList.remove('dragging');

    if (wasDragged) {
      const corner = getNearestCorner(btn);
      applyCorner(btn, corner);
      storeCorner(corner);
      suppressNextClick = true;
      setTimeout(() => {
        suppressNextClick = false;
      }, 100);
    }
  });

  btn.addEventListener('pointercancel', (e) => {
    if (pointerId !== e.pointerId) return;

    pointerId = null;
    btn.classList.remove('dragging');
    applyCorner(btn, (btn.dataset.corner as FabCorner | undefined) ?? getStoredCorner());
  });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (suppressNextClick) {
      e.preventDefault();
      return;
    }

    onClick();
  });

  return btn;
}

export function showFab(fab: HTMLButtonElement): void {
  fab.classList.remove('hidden');
}

export function hideFab(fab: HTMLButtonElement): void {
  fab.classList.add('hidden');
}
