import { Scope } from '@epui/core';
let sequence = 0;
export function uniqueId(prefix = 'eui') {
  return `${prefix}-${++sequence}`;
}
export function preserveAttributes(scope: Scope, element: Element, names: string[]) {
  const before = names.map((name) => [name, element.getAttribute(name)] as const);
  scope.add(() => {
    for (const [name, value] of before)
      if (value === null) element.removeAttribute(name);
      else element.setAttribute(name, value);
  });
}
export function emit(element: HTMLElement, type: string, detail?: unknown, cancelable = false) {
  return element.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, cancelable }));
}
export function isDisabled(element: HTMLElement) {
  return element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true';
}
export function focusableChildren(element: HTMLElement) {
  return [
    ...element.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex]'),
  ].filter(
    (node) =>
      !isDisabled(node) &&
      node.tabIndex >= 0 &&
      !node.closest('[hidden],[inert]') &&
      getComputedStyle(node).display !== 'none' &&
      getComputedStyle(node).visibility !== 'hidden',
  );
}
/** Roving tabindex and locale-aware typeahead; ownership is limited to this collection. */
export function rovingFocus(
  host: HTMLElement,
  scope: Scope,
  getItems: () => HTMLElement[],
  options: {
    orientation?: 'horizontal' | 'vertical' | 'both';
    loop?: boolean;
    activate?: (item: HTMLElement) => void;
    typeahead?: boolean;
  } = {},
) {
  let active: HTMLElement | undefined,
    query = '',
    timer: ReturnType<typeof setTimeout> | undefined;
  const saved = new WeakSet<HTMLElement>();
  function refresh(preferred?: HTMLElement) {
    const all = getItems(),
      enabled = all.filter((item) => !isDisabled(item));
    for (const item of all)
      if (!saved.has(item)) {
        preserveAttributes(scope, item, ['tabindex']);
        saved.add(item);
      }
    active =
      preferred && enabled.includes(preferred)
        ? preferred
        : active && enabled.includes(active)
          ? active
          : enabled[0];
    for (const item of all) item.tabIndex = item === active ? 0 : -1;
  }
  scope.listen(host, 'focusin', (event) => {
    const item = getItems().find(
      (item) => item === event.target || item.contains(event.target as Node),
    );
    if (item && !isDisabled(item)) refresh(item);
  });
  scope.listen(host, 'keydown', (event) => {
    const e = event as KeyboardEvent;
    if (e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return;
    const items = getItems().filter((item) => !isDisabled(item));
    const current = items.findIndex(
      (item) => item === document.activeElement || item.contains(document.activeElement),
    );
    if (current < 0 || !items.length) return;
    let next = current;
    const rtl = getComputedStyle(host).direction === 'rtl',
      horizontal = options.orientation !== 'vertical',
      vertical = options.orientation !== 'horizontal';
    if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    else if (horizontal && (e.key === 'ArrowRight' || e.key === 'ArrowLeft'))
      next += (e.key === 'ArrowRight' ? 1 : -1) * (rtl ? -1 : 1);
    else if (vertical && (e.key === 'ArrowDown' || e.key === 'ArrowUp'))
      next += e.key === 'ArrowDown' ? 1 : -1;
    else if (options.typeahead && e.key.length === 1 && e.key !== ' ') {
      clearTimeout(timer);
      query += e.key.toLocaleLowerCase();
      timer = setTimeout(() => {
        query = '';
      }, 500);
      const term = [...query].every((c) => c === query[0]) ? query[0]! : query;
      for (let offset = 1; offset <= items.length; offset++) {
        const index = (current + offset) % items.length;
        if (items[index]!.textContent?.trim().toLocaleLowerCase().startsWith(term)) {
          next = index;
          break;
        }
      }
    } else return;
    e.preventDefault();
    next =
      options.loop === false
        ? Math.max(0, Math.min(items.length - 1, next))
        : (next + items.length) % items.length;
    refresh(items[next]);
    active?.focus();
    if (active) options.activate?.(active);
  });
  scope.add(() => clearTimeout(timer));
  refresh();
  return {
    refresh,
    focus(item?: HTMLElement) {
      refresh(item);
      active?.focus();
    },
  };
}
