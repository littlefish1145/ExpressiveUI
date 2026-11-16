import { mount } from './shared.js';
import { interactive } from './interactive.js';
import { emit, rovingFocus, isDisabled } from './collection.js';
import type { MotionScheme } from '@expressive-ui/motion';
import { observeSize } from '@expressive-ui/core';
import { roundedRectangle } from '@expressive-ui/shape';
import { bindElevation } from './elevation.js';
export interface ChipOptions {
  variant?: 'assist' | 'filter' | 'input' | 'suggestion';
  selected?: boolean;
  elevated?: boolean;
  motionScheme?: MotionScheme;
  onRemove?: () => void;
}
export function enhanceChip(element: HTMLButtonElement, initial: ChipOptions = {}) {
  const scope = mount(element, 'eui-chip', [
    'data-variant',
    'data-selected',
    'data-elevated',
    'data-pressed',
    'aria-pressed',
    'style',
  ]);
  let options = { ...initial };
  const content = document.createElement('span');
  content.className = 'eui-chip-content';
  content.append(...element.childNodes);
  element.append(content);
  scope.add(() => content.replaceWith(...content.childNodes));
  const effects = interactive(element, scope, options.motionScheme);
  const elevation = bindElevation(
    element,
    options.elevated ? 1 : 0,
    options.elevated ? 2 : 0,
    options.motionScheme,
  );
  elevation.setRadius(8);
  scope.add(() => elevation.destroy());
  const size = observeSize(element, (w, h) =>
    effects.setContour(roundedRectangle(Math.max(1, w), Math.max(1, h), 8)),
  );
  scope.add(() => size.destroy());
  function refresh() {
    if (scope.disposed) return;
    element.dataset.variant = options.variant ?? 'assist';
    element.dataset.selected = String(
      (options.variant === 'filter' || options.variant === 'input') && !!options.selected,
    );
    element.dataset.elevated = String(options.elevated ?? false);
    if (options.variant === 'filter' || options.variant === 'input')
      element.setAttribute('aria-pressed', String(options.selected ?? false));
    else element.removeAttribute('aria-pressed');
    effects.refresh();
    elevation.configure(
      options.elevated ? 1 : 0,
      options.elevated ? 2 : 0,
      options.motionScheme ?? 'expressive',
    );
  }
  function setSelected(selected: boolean, notify = false) {
    if (scope.disposed || selected === !!options.selected) return;
    options.selected = selected;
    refresh();
    if (notify) emit(element, 'eui-change', { selected });
  }
  scope.listen(element, 'click', (event) => {
    if (isDisabled(element)) return;
    queueMicrotask(() => {
      if (scope.disposed || event.defaultPrevented) return;
      if (options.variant === 'filter' || options.variant === 'input')
        setSelected(!options.selected, true);
    });
  });
  scope.listen(element, 'keydown', (event) => {
    const e = event as KeyboardEvent;
    if (
      (e.key === 'Delete' || e.key === 'Backspace') &&
      options.variant === 'input' &&
      !isDisabled(element)
    ) {
      e.preventDefault();
      if (emit(element, 'eui-remove', undefined, true)) options.onRemove?.();
    }
  });
  refresh();
  return {
    element,
    refresh,
    get selected() {
      return !!options.selected;
    },
    setSelected,
    update(next: Partial<ChipOptions>) {
      options = { ...options, ...next };
      effects.configure(options.motionScheme ?? 'expressive');
      refresh();
    },
    destroy() {
      scope.dispose();
    },
  };
}
export interface ChipSetOptions {
  label?: string;
}
export function enhanceChipSet(host: HTMLElement, options: ChipSetOptions = {}) {
  const scope = mount(host, 'eui-chip-set', ['role', 'aria-label']);
  host.setAttribute('role', 'group');
  if (options.label) host.setAttribute('aria-label', options.label);
  const focus = rovingFocus(
    host,
    scope,
    () => [...host.querySelectorAll<HTMLButtonElement>('.eui-chip')],
    { orientation: 'horizontal' },
  );
  const observer = new MutationObserver(() => focus.refresh());
  observer.observe(host, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['disabled', 'aria-disabled'],
  });
  scope.add(() => observer.disconnect());
  return {
    element: host,
    refresh: focus.refresh,
    destroy() {
      scope.dispose();
    },
  };
}
