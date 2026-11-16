import { mount } from './shared.js';
import { interactive } from './interactive.js';
import { preserveAttributes } from './collection.js';
import { bindElevation } from './elevation.js';
import type { MotionScheme } from '@amiracle1024/motion';
export interface CardOptions {
  variant?: 'filled' | 'outlined' | 'elevated';
  motionScheme?: MotionScheme;
}
export function enhanceCard(host: HTMLElement, initial: CardOptions = {}) {
  const scope = mount(host, 'eui-card', ['data-variant', 'data-pressed', 'style']);
  let options = { ...initial };
  if (host.tagName === 'BUTTON')
    interactive(host as HTMLButtonElement, scope, options.motionScheme);
  const elevation = bindElevation(
    host,
    options.variant === 'elevated' ? 1 : 0,
    options.variant === 'elevated' ? 2 : 0,
    options.motionScheme,
  );
  scope.add(() => elevation.destroy());
  function refresh() {
    if (scope.disposed) return;
    host.dataset.variant = options.variant ?? 'filled';
    elevation.setRadius(12);
    elevation.configure(
      options.variant === 'elevated' ? 1 : 0,
      options.variant === 'elevated' ? 2 : 0,
      options.motionScheme ?? 'expressive',
    );
  }
  refresh();
  return {
    element: host,
    refresh,
    update(next: Partial<CardOptions>) {
      options = { ...options, ...next };
      refresh();
    },
    destroy() {
      scope.dispose();
    },
  };
}
export interface BadgeOptions {
  value?: number | string;
  max?: number;
  showZero?: boolean;
  label?: string;
}
export function enhanceBadge(host: HTMLElement, initial: BadgeOptions = {}) {
  const scope = mount(host, 'eui-badge', ['role', 'aria-label', 'data-dot', 'hidden']);
  const nodes = [...host.childNodes];
  let options = { ...initial };
  function refresh() {
    if (scope.disposed) return;
    const value = options.value,
      max = options.max ?? 99;
    host.dataset.dot = String(value === undefined || value === '');
    host.hidden = value === 0 && !options.showZero;
    host.textContent = typeof value === 'number' && value > max ? `${max}+` : String(value ?? '');
    if (options.label || host.hasAttribute('aria-label')) {
      host.setAttribute('role', 'img');
      if (options.label) host.setAttribute('aria-label', options.label);
    }
  }
  scope.add(() => host.replaceChildren(...nodes));
  refresh();
  return {
    element: host,
    update(next: Partial<BadgeOptions>) {
      options = { ...options, ...next };
      refresh();
    },
    destroy() {
      scope.dispose();
    },
  };
}
export interface DividerOptions {
  orientation?: 'horizontal' | 'vertical';
  inset?: boolean;
}
export function enhanceDivider(host: HTMLElement, initial: DividerOptions = {}) {
  const scope = mount(host, 'eui-divider', ['role', 'aria-orientation', 'data-inset']);
  function update(options: DividerOptions) {
    host.setAttribute('role', 'separator');
    host.setAttribute('aria-orientation', options.orientation ?? 'horizontal');
    host.dataset.inset = String(options.inset ?? false);
  }
  update(initial);
  return {
    element: host,
    update,
    destroy() {
      scope.dispose();
    },
  };
}
export interface ListOptions {
  variant?: 'baseline' | 'expressive';
}
export function enhanceList(host: HTMLElement, options: ListOptions = {}) {
  const scope = mount(host, 'eui-list', ['role', 'data-variant']);
  if (!['UL', 'OL'].includes(host.tagName)) host.setAttribute('role', 'list');
  host.dataset.variant = options.variant ?? 'baseline';
  const items = [...host.querySelectorAll<HTMLElement>('[data-list-item]')];
  for (const item of items) {
    preserveAttributes(scope, item, ['class', 'role', 'data-lines']);
    item.classList.add('eui-list-item');
    if (item.tagName !== 'LI') item.setAttribute('role', 'listitem');
    if (!item.dataset.lines)
      item.dataset.lines = item.querySelector('[data-supporting]') ? '2' : '1';
  }
  return {
    element: host,
    destroy() {
      scope.dispose();
    },
  };
}
