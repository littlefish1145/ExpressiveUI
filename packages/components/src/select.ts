import { mount } from './shared.js';
import { uniqueId, emit } from './collection.js';
import { overlay } from './overlay.js';
import { enhanceButton } from './button.js';
import type { MotionScheme } from '@expressive-ui/motion';
import { createSpring, motionPreset } from '@expressive-ui/motion';
import { createChevronDown } from './svg.js';
export interface SelectOptions {
  label?: string;
  variant?: 'text' | 'outlined' | 'tonal';
  motionScheme?: MotionScheme;
}
/** Native select owns the value/form; the visible select-only combobox owns interaction. */
export function enhanceSelect(select: HTMLSelectElement, initial: SelectOptions = {}) {
  if (select.multiple || select.size > 1)
    throw new TypeError('Select requires a single-value native select');
  const scope = mount(select, 'eui-select-native', ['tabindex', 'aria-hidden', 'style']);
  let options = { ...initial };
  const originalLabel =
    select.getAttribute('aria-label') ??
    [...(select.labels ?? [])]
      .map((node) => {
        const copy = node.cloneNode(true) as HTMLElement;
        for (const child of copy.querySelectorAll('select,.eui-select-trigger,.eui-select-listbox'))
          child.remove();
        return copy.textContent?.trim();
      })
      .join(' ');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'eui-select-trigger';
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  const value = document.createElement('span'),
    chevron = document.createElement('span');
  value.className = 'eui-select-value';
  chevron.className = 'eui-select-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.append(createChevronDown());
  trigger.append(value, chevron);
  select.after(trigger);
  scope.add(() => trigger.remove());
  const styled = enhanceButton(trigger, {
    variant: options.variant ?? 'outlined',
    motionScheme: options.motionScheme ?? 'expressive',
  });
  scope.add(() => styled.destroy());
  const popup = document.createElement('div');
  popup.className = 'eui-select-listbox';
  popup.id = uniqueId('eui-select-list');
  popup.setAttribute('role', 'listbox');
  trigger.after(popup);
  scope.add(() => popup.remove());
  trigger.setAttribute('aria-controls', popup.id);
  const error = document.createElement('span');
  error.className = 'eui-select-error';
  error.id = uniqueId('eui-select-error');
  error.hidden = true;
  error.setAttribute('aria-live', 'polite');
  popup.after(error);
  scope.add(() => error.remove());
  const controller = overlay(popup, scope, {
    anchor: trigger,
    kind: 'tooltip',
    maxHeight: 320,
    restoreFocus: false,
    motionScheme: options.motionScheme ?? 'expressive',
  });
  const rotation = createSpring(
    0,
    (angle) => (chevron.style.transform = `rotate(${angle}deg)`),
    motionPreset(options.motionScheme, 'default.effects'),
  );
  scope.add(() => rotation.destroy());
  scope.listen(popup, 'eui-open', () => rotation.setTarget(180));
  scope.listen(popup, 'eui-closing', () => rotation.setTarget(0));
  let active = -1,
    query = '',
    timer: ReturnType<typeof setTimeout> | undefined,
    optionNodes: HTMLElement[] = [],
    signature = '';
  function enabled(index: number) {
    const option = select.options[index];
    return (
      !!option &&
      !option.disabled &&
      !(option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled) &&
      !option.hidden
    );
  }
  function label() {
    return (options.label ?? select.getAttribute('aria-label') ?? originalLabel) || '选择选项';
  }
  function paint() {
    for (const [index, node] of optionNodes.entries()) {
      node.dataset.active = String(index === active);
      node.setAttribute('aria-selected', String(index === select.selectedIndex));
    }
    if (active >= 0 && controller.isOpen)
      trigger.setAttribute('aria-activedescendant', `${popup.id}-${active}`);
    else trigger.removeAttribute('aria-activedescendant');
  }
  function scrollActive() {
    const node = optionNodes[active];
    if (!node) return;
    const top = node.offsetTop,
      bottom = top + node.offsetHeight;
    if (top < popup.scrollTop) popup.scrollTop = top;
    else if (bottom > popup.scrollTop + popup.clientHeight)
      popup.scrollTop = bottom - popup.clientHeight;
  }
  function refresh() {
    if (scope.disposed) return;
    trigger.disabled = select.matches(':disabled');
    value.textContent = select.selectedOptions[0]?.label ?? '';
    trigger.setAttribute(
      'aria-label',
      `${label()}${value.textContent ? '：' + value.textContent : ''}`,
    );
    trigger.setAttribute(
      'aria-describedby',
      [select.getAttribute('aria-describedby'), !error.hidden ? error.id : '']
        .filter(Boolean)
        .join(' '),
    );
    if (select.validity.valid) {
      error.hidden = true;
      error.textContent = '';
    }
    trigger.setAttribute('aria-required', String(select.required));
    if (select.getAttribute('aria-invalid') === 'true' || !error.hidden)
      trigger.setAttribute('aria-invalid', 'true');
    else trigger.removeAttribute('aria-invalid');
    popup.setAttribute('aria-label', label());
    const next = [...select.options]
      .map(
        (option) =>
          `${option.label}|${option.value}|${option.disabled}|${option.hidden}|${option.parentElement instanceof HTMLOptGroupElement ? option.parentElement.disabled : ''}`,
      )
      .join('\n');
    if (next !== signature) {
      signature = next;
      popup.replaceChildren();
      optionNodes = [];
      let group: Element | null = null;
      for (const [index, option] of [...select.options].entries()) {
        if (option.parentElement instanceof HTMLOptGroupElement && option.parentElement !== group) {
          group = option.parentElement;
          const heading = document.createElement('div');
          heading.className = 'eui-select-group';
          heading.setAttribute('role', 'presentation');
          heading.textContent = option.parentElement.label;
          popup.append(heading);
        }
        const node = document.createElement('div');
        node.id = `${popup.id}-${index}`;
        node.className = 'eui-select-option';
        node.setAttribute('role', 'option');
        node.setAttribute('aria-disabled', String(!enabled(index)));
        node.dataset.index = String(index);
        node.textContent = option.label;
        node.hidden = option.hidden;
        optionNodes.push(node);
        popup.append(node);
      }
    }
    paint();
    if (trigger.disabled && controller.isOpen) close();
    styled.refresh();
  }
  function open() {
    if (scope.disposed || select.matches(':disabled')) return;
    refresh();
    active = select.selectedIndex;
    if (!enabled(active)) active = [...select.options].findIndex((_, index) => enabled(index));
    popup.style.minWidth = `${trigger.offsetWidth}px`;
    controller.open();
    trigger.setAttribute('aria-expanded', String(controller.isOpen));
    paint();
    scrollActive();
  }
  function close() {
    controller.close();
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-activedescendant');
    query = '';
  }
  function choose(index: number) {
    if (!enabled(index)) return;
    const previous = select.value;
    select.selectedIndex = index;
    active = index;
    refresh();
    close();
    if (previous !== select.value) {
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      emit(select, 'eui-change', { value: select.value });
    }
    trigger.focus({ preventScroll: true });
  }
  scope.listen(trigger, 'click', () => {
    if (controller.isOpen) close();
    else open();
  });
  scope.listen(trigger, 'keydown', (event) => {
    const e = event as KeyboardEvent;
    if (e.altKey && e.key === 'ArrowUp') {
      e.preventDefault();
      if (controller.isOpen) choose(active);
      return;
    }
    if (e.ctrlKey || e.metaKey || e.isComposing) return;
    if (e.key === 'Escape') {
      if (controller.isOpen) {
        e.preventDefault();
        close();
      }
      return;
    }
    if (e.key === 'Tab') {
      close();
      return;
    }
    if (e.key === 'Enter' || (e.key === ' ' && !query)) {
      e.preventDefault();
      if (controller.isOpen) choose(active);
      else open();
      return;
    }
    const arrow = e.key === 'ArrowDown' || e.key === 'ArrowUp',
      boundary = e.key === 'Home' || e.key === 'End';
    if (arrow || boundary) {
      e.preventDefault();
      if (!controller.isOpen) open();
      const direction = e.key === 'ArrowUp' || e.key === 'End' ? -1 : 1;
      let next = boundary ? (e.key === 'Home' ? 0 : select.options.length - 1) : active + direction;
      while (next >= 0 && next < select.options.length && !enabled(next)) next += direction;
      if (enabled(next)) active = next;
      paint();
      scrollActive();
      return;
    }
    if (e.key.length === 1 && !e.altKey) {
      e.preventDefault();
      clearTimeout(timer);
      query += e.key.toLocaleLowerCase();
      timer = setTimeout(() => (query = ''), 500);
      if (!controller.isOpen) open();
      const term = [...query].every((c) => c === query[0]) ? query[0]! : query;
      for (let step = 1; step <= select.options.length; step++) {
        const index = (active + step + select.options.length) % select.options.length;
        if (enabled(index) && select.options[index]!.label.toLocaleLowerCase().startsWith(term)) {
          active = index;
          break;
        }
      }
      paint();
      scrollActive();
    }
  });
  scope.listen(popup, 'pointerdown', (event) => event.preventDefault());
  scope.listen(popup, 'click', (event) => {
    const node = (event.target as Element).closest<HTMLElement>('[data-index]');
    if (node) choose(Number(node.dataset.index));
  });
  scope.listen(trigger, 'blur', close);
  scope.listen(popup, 'eui-closing', () => {
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-activedescendant');
  });
  scope.listen(select, 'change', refresh);
  scope.listen(select, 'focus', () => trigger.focus({ preventScroll: true }));
  scope.listen(select, 'invalid', (event) => {
    event.preventDefault();
    trigger.setAttribute('aria-invalid', 'true');
    error.textContent = select.validationMessage;
    error.hidden = false;
    trigger.setAttribute(
      'aria-describedby',
      [select.getAttribute('aria-describedby'), error.id].filter(Boolean).join(' '),
    );
    trigger.focus({ preventScroll: true });
  });
  if (select.form)
    scope.listen(select.form, 'reset', (event) =>
      queueMicrotask(() => {
        if (!event.defaultPrevented) refresh();
      }),
    );
  for (const nativeLabel of select.labels ?? [])
    scope.listen(nativeLabel, 'click', (event) => {
      // A listbox option is inside the original label too. Suppress its label
      // activation or the browser may open the hidden native select afterwards.
      event.preventDefault();
      if (!trigger.contains(event.target as Node) && !popup.contains(event.target as Node)) {
        trigger.focus({ preventScroll: true });
      }
    });
  const observer = new MutationObserver(refresh);
  observer.observe(select, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [
      'disabled',
      'selected',
      'value',
      'label',
      'hidden',
      'required',
      'aria-invalid',
      'aria-label',
    ],
  });
  for (let node: HTMLElement | null = select.parentElement; node; node = node.parentElement)
    if (node.tagName === 'FIELDSET')
      observer.observe(node, { attributes: true, attributeFilter: ['disabled'] });
  scope.add(() => {
    observer.disconnect();
    clearTimeout(timer);
  });
  refresh();
  return {
    element: select,
    trigger,
    open,
    close,
    get value() {
      return select.value;
    },
    refresh,
    setValue(next: string, { notify = false } = {}) {
      if (scope.disposed) return;
      const previous = select.value;
      select.value = next;
      refresh();
      if (notify && previous !== select.value) {
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    },
    update(next: Partial<SelectOptions>) {
      options = { ...options, ...next };
      rotation.configure(motionPreset(options.motionScheme, 'default.effects'));
      styled.update({
        variant: options.variant ?? 'outlined',
        motionScheme: options.motionScheme ?? 'expressive',
      });
      controller.configure({ motionScheme: options.motionScheme ?? 'expressive' });
      refresh();
    },
    destroy() {
      scope.dispose();
    },
  };
}
