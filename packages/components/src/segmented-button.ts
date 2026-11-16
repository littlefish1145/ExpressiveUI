import { mount } from './shared.js';
import { interactive } from './interactive.js';
import { preserveAttributes, emit, rovingFocus, isDisabled } from './collection.js';
import type { MotionScheme } from '@expressive-ui/motion';
export interface SegmentedButtonOptions {
  multiple?: boolean;
  allowEmpty?: boolean;
  label?: string;
  motionScheme?: MotionScheme;
}
export function enhanceSegmentedButtons(host: HTMLElement, initial: SegmentedButtonOptions = {}) {
  const scope = mount(host, 'eui-segmented-buttons', ['role', 'aria-label', 'data-multiple']);
  let options = { ...initial };
  const items = () => [...host.querySelectorAll<HTMLButtonElement>('button[data-value]')];
  const buttons = items();
  const effects: ReturnType<typeof interactive>[] = [];
  if (!buttons.length) throw new TypeError('Segmented buttons require button[data-value]');
  for (const button of buttons) {
    preserveAttributes(scope, button, [
      'class',
      'aria-pressed',
      'data-selected',
      'data-pressed',
      'style',
    ]);
    button.classList.add('eui-segment');
    effects.push(interactive(button, scope, options.motionScheme));
  }
  const focus = rovingFocus(host, scope, items, { orientation: 'horizontal' });
  let selected = new Set(
    buttons
      .filter((b) => b.getAttribute('aria-pressed') === 'true' || b.dataset.selected === 'true')
      .map((b) => b.dataset.value!),
  );
  function refresh() {
    host.setAttribute('role', 'group');
    if (options.label) host.setAttribute('aria-label', options.label);
    host.dataset.multiple = String(options.multiple ?? false);
    if (!options.multiple && selected.size > 1) selected = new Set([...selected].slice(0, 1));
    if (!options.allowEmpty && !selected.size) {
      const first = buttons.find((b) => !isDisabled(b));
      if (first) selected.add(first.dataset.value!);
    }
    for (const b of buttons) {
      const checked = selected.has(b.dataset.value!);
      b.setAttribute('aria-pressed', String(checked));
      b.dataset.selected = String(checked);
    }
    focus.refresh();
  }
  scope.listen(host, 'click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-value]');
    if (!button || !buttons.includes(button) || isDisabled(button)) return;
    queueMicrotask(() => {
      if (scope.disposed || event.defaultPrevented) return;
      const value = button.dataset.value!;
      if (selected.has(value)) {
        if (options.allowEmpty || selected.size > 1) selected.delete(value);
      } else {
        if (!options.multiple) selected.clear();
        selected.add(value);
      }
      refresh();
      emit(host, 'eui-change', { values: [...selected] });
    });
  });
  refresh();
  return {
    element: host,
    get values() {
      return [...selected];
    },
    setValues(values: readonly string[]) {
      selected = new Set(values.filter((value) => buttons.some((b) => b.dataset.value === value)));
      refresh();
    },
    refresh,
    update(next: Partial<SegmentedButtonOptions>) {
      options = { ...options, ...next };
      for (const effect of effects) effect.configure(options.motionScheme ?? 'expressive');
      refresh();
    },
    destroy() {
      scope.dispose();
    },
  };
}
