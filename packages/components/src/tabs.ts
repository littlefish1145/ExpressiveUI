import { observeSize } from '@epui/core';
import { createSpring, motionPreset } from '@epui/motion';
import type { MotionScheme } from '@epui/motion';
import { mount } from './shared.js';
import { preserveAttributes, rovingFocus, uniqueId, emit, isDisabled } from './collection.js';
import { interactive } from './interactive.js';
export interface TabsOptions {
  variant?: 'primary' | 'secondary';
  activation?: 'automatic' | 'manual';
  orientation?: 'horizontal' | 'vertical';
  selected?: string;
  motionScheme?: MotionScheme;
  label?: string;
}
export function enhanceTabs(host: HTMLElement, initial: TabsOptions = {}) {
  const scope = mount(host, 'eui-tabs', [
    'role',
    'aria-label',
    'aria-orientation',
    'data-variant',
    'style',
  ]);
  let options = { ...initial };
  const items = [...host.querySelectorAll<HTMLButtonElement>('button[data-tab]')];
  if (!items.length) throw new TypeError('Tabs require button[data-tab]');
  const panels = new Map<HTMLButtonElement, HTMLElement>();
  const effects: ReturnType<typeof interactive>[] = [];
  for (const item of items) {
    preserveAttributes(scope, item, [
      'role',
      'aria-selected',
      'aria-controls',
      'id',
      'tabindex',
      'class',
      'data-selected',
      'data-pressed',
      'style',
    ]);
    if (!item.id) item.id = uniqueId('eui-tab');
    item.setAttribute('role', 'tab');
    item.classList.add('eui-tab');
    effects.push(interactive(item, scope, options.motionScheme));
    const panel = document.getElementById(item.dataset.tab!);
    if (panel) {
      panels.set(item, panel);
      preserveAttributes(scope, panel, ['role', 'aria-labelledby', 'hidden', 'tabindex']);
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', item.id);
      if (!panel.hasAttribute('tabindex')) panel.tabIndex = 0;
      item.setAttribute('aria-controls', panel.id);
    }
  }
  let selected =
    options.selected ??
    items.find((i) => i.getAttribute('aria-selected') === 'true')?.dataset.tab ??
    items.find((i) => !isDisabled(i))?.dataset.tab;
  const indicator = document.createElement('span');
  indicator.className = 'eui-tab-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  host.append(indicator);
  scope.add(() => indicator.remove());
  let x = 0,
    width = 0;
  function draw() {
    indicator.style.transform = `translateX(${x}px)`;
    indicator.style.width = `${Math.max(0, width)}px`;
  }
  const position = createSpring(
      0,
      (value) => {
        x = value;
        draw();
      },
      motionPreset(options.motionScheme, 'default.spatial'),
    ),
    size = createSpring(
      0,
      (value) => {
        width = value;
        draw();
      },
      motionPreset(options.motionScheme, 'default.spatial'),
    );
  scope.add(() => {
    position.destroy();
    size.destroy();
  });
  function measure(animate = true) {
    const item = items.find((i) => i.dataset.tab === selected);
    if (!item) return;
    const targetWidth =
      options.variant === 'secondary'
        ? item.offsetWidth
        : Math.max(
            24,
            item.querySelector<HTMLElement>('[data-label]')?.offsetWidth ?? item.offsetWidth - 32,
          );
    const targetX = item.offsetLeft + (item.offsetWidth - targetWidth) / 2;
    if (animate) {
      position.setTarget(targetX);
      size.setTarget(targetWidth);
    } else {
      position.jump(targetX);
      size.jump(targetWidth);
    }
  }
  const focus = rovingFocus(host, scope, () => items, {
    orientation: options.orientation ?? 'horizontal',
    activate: (item) => {
      if (options.activation !== 'manual') select(item.dataset.tab!, true);
    },
  });
  function refresh(animate = true) {
    host.setAttribute('role', 'tablist');
    host.setAttribute('aria-orientation', options.orientation ?? 'horizontal');
    host.dataset.variant = options.variant ?? 'primary';
    if (options.label) host.setAttribute('aria-label', options.label);
    for (const item of items) {
      const active = item.dataset.tab === selected;
      item.setAttribute('aria-selected', String(active));
      item.dataset.selected = String(active);
      const panel = panels.get(item);
      if (panel) panel.hidden = !active;
    }
    focus.refresh(items.find((i) => i.dataset.tab === selected));
    measure(animate);
  }
  function select(value: string, notify = false) {
    if (
      scope.disposed ||
      !items.some((i) => i.dataset.tab === value && !isDisabled(i)) ||
      selected === value
    )
      return;
    if (notify && !emit(host, 'eui-beforechange', { value }, true)) return;
    selected = value;
    refresh();
    if (notify) emit(host, 'eui-change', { value });
  }
  scope.listen(host, 'click', (event) => {
    const item = items.find((i) => i === event.target || i.contains(event.target as Node));
    if (item)
      queueMicrotask(() => {
        if (!event.defaultPrevented) select(item.dataset.tab!, true);
      });
  });
  const resize = observeSize(host, () => measure(false));
  scope.add(() => resize.destroy());
  refresh(false);
  return {
    element: host,
    get value() {
      return selected;
    },
    select,
    refresh,
    update(next: Partial<TabsOptions>) {
      options = { ...options, ...next };
      for (const effect of effects) effect.configure(options.motionScheme ?? 'expressive');
      for (const spring of [position, size])
        spring.configure(motionPreset(options.motionScheme, 'default.spatial'));
      if (next.selected !== undefined) selected = next.selected;
      refresh();
    },
    destroy() {
      scope.dispose();
    },
  };
}
