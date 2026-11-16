import { createSpring, motionPreset } from '@amiracle1024/motion';
import type { MotionScheme } from '@amiracle1024/motion';
import { mount } from './shared.js';
import { preserveAttributes, emit, isDisabled } from './collection.js';
import { interactive } from './interactive.js';
import { overlay } from './overlay.js';
export interface NavigationOptions {
  variant?: 'bar' | 'rail' | 'drawer';
  label?: string;
  selected?: string;
  expanded?: boolean;
  modal?: boolean;
  motionScheme?: MotionScheme;
}
export function enhanceNavigation(host: HTMLElement, initial: NavigationOptions = {}) {
  const scope = mount(host, 'eui-navigation', [
    'role',
    'aria-label',
    'data-variant',
    'data-expanded',
    'style',
    'open',
  ]);
  let options = { ...initial };
  host.setAttribute('role', 'navigation');
  const items = [...host.querySelectorAll<HTMLElement>('[data-nav-item]')];
  let selected =
    options.selected ?? items.find((i) => i.hasAttribute('aria-current'))?.dataset.navItem;
  const effects: ReturnType<typeof interactive>[] = [],
    indicators: { item: HTMLElement; spring: ReturnType<typeof createSpring> }[] = [];
  for (const item of items) {
    preserveAttributes(scope, item, [
      'aria-current',
      'class',
      'data-selected',
      'data-pressed',
      'style',
    ]);
    item.classList.add('eui-navigation-item');
    if (item.tagName === 'BUTTON')
      effects.push(interactive(item as HTMLButtonElement, scope, options.motionScheme));
    const indicator = document.createElement('span');
    indicator.className = 'eui-navigation-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    item.prepend(indicator);
    const spring = createSpring(
      item.dataset.navItem === selected ? 1 : 0,
      (value) => {
        indicator.style.transform = `scaleX(${Math.max(0, value)})`;
        indicator.style.opacity = String(Math.min(1, Math.max(0, value)));
      },
      motionPreset(options.motionScheme, 'fast.spatial'),
    );
    indicators.push({ item, spring });
    scope.add(() => {
      spring.destroy();
      indicator.remove();
    });
  }
  const expansion = createSpring(
    options.expanded ? 220 : 96,
    (value) => host.style.setProperty('--_eui-rail-width', `${value}px`),
    motionPreset(options.motionScheme, 'default.spatial'),
  );
  scope.add(() => expansion.destroy());
  const modal = options.modal
    ? overlay(host, scope, {
        modal: true,
        kind: 'drawer',
        motionScheme: options.motionScheme ?? 'expressive',
      })
    : undefined;
  function refresh(animate = true) {
    if (scope.disposed) return;
    host.dataset.variant = options.variant ?? 'bar';
    host.dataset.expanded = String(options.expanded ?? false);
    if (options.label) host.setAttribute('aria-label', options.label);
    for (const { item, spring } of indicators) {
      const active = item.dataset.navItem === selected;
      item.dataset.selected = String(active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
      if (animate) spring.setTarget(active ? 1 : 0);
      else spring.jump(active ? 1 : 0);
    }
    if (animate) expansion.setTarget(options.expanded ? 220 : 96);
    else expansion.jump(options.expanded ? 220 : 96);
    for (const e of effects) e.refresh();
  }
  function select(value: string, notify = false) {
    const item = items.find((i) => i.dataset.navItem === value);
    if (scope.disposed || !item || isDisabled(item)) return;
    if (notify && !emit(host, 'eui-beforechange', { value }, true)) return;
    selected = value;
    refresh();
    if (notify) emit(host, 'eui-change', { value });
  }
  scope.listen(host, 'click', (event) => {
    const item = items.find((i) => i === event.target || i.contains(event.target as Node));
    if (item)
      queueMicrotask(() => {
        if (!event.defaultPrevented) {
          select(item.dataset.navItem!, true);
          modal?.close('select');
        }
      });
  });
  refresh(false);
  return {
    element: host,
    get value() {
      return selected;
    },
    select,
    refresh,
    open() {
      modal?.open();
    },
    close() {
      modal?.close();
    },
    get isOpen() {
      return modal?.isOpen ?? true;
    },
    setExpanded(expanded: boolean) {
      options.expanded = expanded;
      refresh();
    },
    update(next: Partial<NavigationOptions>) {
      options = { ...options, ...next };
      for (const effect of effects) effect.configure(options.motionScheme ?? 'expressive');
      for (const { spring } of indicators)
        spring.configure(motionPreset(options.motionScheme, 'fast.spatial'));
      expansion.configure(motionPreset(options.motionScheme, 'default.spatial'));
      modal?.configure({ motionScheme: options.motionScheme ?? 'expressive' });
      if (next.selected !== undefined) selected = next.selected;
      refresh();
    },
    destroy() {
      scope.dispose();
    },
  };
}
export function enhanceNavigationBar(
  host: HTMLElement,
  options: Omit<NavigationOptions, 'variant'> = {},
) {
  return enhanceNavigation(host, { ...options, variant: 'bar' });
}
export function enhanceNavigationRail(
  host: HTMLElement,
  options: Omit<NavigationOptions, 'variant'> = {},
) {
  return enhanceNavigation(host, { ...options, variant: 'rail' });
}
export function enhanceNavigationDrawer(
  host: HTMLElement,
  options: Omit<NavigationOptions, 'variant'> = {},
) {
  return enhanceNavigation(host, { ...options, variant: 'drawer' });
}
