/**
 * Generate a unique CSS selector for a given DOM element.
 *
 * Priority: id > data-testid > path (tag + classes + nth-of-type).
 * Max 5 levels deep. Verified by querySelectorAll.
 */

const DYNAMIC_CLASS_RE = /[0-9a-f]{5,}|^-?[0-9]|__|--[a-z0-9]{4,}/i;

function isDynamicClass(cls: string): boolean {
  return DYNAMIC_CLASS_RE.test(cls);
}

function getStableClasses(el: Element): string[] {
  return Array.from(el.classList).filter((c) => !isDynamicClass(c));
}

function nthOfType(el: Element): string {
  const parent = el.parentElement;
  if (!parent) return el.tagName.toLowerCase();
  const tag = el.tagName.toLowerCase();
  const siblings = Array.from(parent.children).filter((s) => s.tagName === el.tagName);
  if (siblings.length === 1) return tag;
  const idx = siblings.indexOf(el) + 1;
  return `${tag}:nth-of-type(${idx})`;
}

function buildStep(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const classes = getStableClasses(el);
  const classStr = classes.length > 0 ? '.' + classes.join('.') : '';
  const base = tag + classStr;

  // check uniqueness among siblings with same tag
  const parent = el.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter(
      (s) => s.tagName === el.tagName && s !== el,
    );
    // If base is unique among siblings, no nth needed
    const sameBase = siblings.filter((s) => {
      const sc = getStableClasses(s);
      const scStr = sc.length > 0 ? '.' + sc.join('.') : '';
      return s.tagName.toLowerCase() + scStr === base;
    });
    if (sameBase.length === 0) return base;
  }

  return nthOfType(el) + classStr;
}

function isUnique(selector: string, target: Element): boolean {
  try {
    const matches = document.querySelectorAll(selector);
    return matches.length === 1 && matches[0] === target;
  } catch {
    return false;
  }
}

export function generateSelector(el: Element): string {
  // 1. id
  if (el.id) {
    const sel = `#${CSS.escape(el.id)}`;
    if (isUnique(sel, el)) return sel;
  }

  // 2. data-testid
  const testId = el.getAttribute('data-testid');
  if (testId) {
    const sel = `[data-testid="${CSS.escape(testId)}"]`;
    if (isUnique(sel, el)) return sel;
  }

  // 3. Build path (max 5 levels)
  const parts: string[] = [];
  let current: Element | null = el;

  for (let depth = 0; depth < 5 && current && current !== document.body && current !== document.documentElement; depth++) {
    parts.unshift(buildStep(current));

    // Check if current partial path is unique
    const selector = parts.join(' > ');
    if (isUnique(selector, el)) return selector;

    current = current.parentElement;
  }

  // Return best effort
  const finalSelector = parts.join(' > ');
  if (isUnique(finalSelector, el)) return finalSelector;

  // Fallback: add body prefix
  const withBody = 'body > ' + finalSelector;
  if (isUnique(withBody, el)) return withBody;

  return finalSelector;
}
