/**
 * Create the floating action button element.
 * Uses an SVG bug icon.
 */
export function createFab(onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'scout-fab';
  btn.setAttribute('aria-label', 'Сообщить о баге');
  btn.title = 'Сообщить о баге';

  // Bug/report icon (simplified)
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 2l1.5 1.5M16 2l-1.5 1.5"/>
      <path d="M3 10h2M19 10h2M3 14h2M19 14h2"/>
      <circle cx="12" cy="12" r="5"/>
      <path d="M12 7v10M7 12h10"/>
    </svg>
  `;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
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
