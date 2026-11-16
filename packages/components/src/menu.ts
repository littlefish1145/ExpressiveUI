import { mount } from './shared.js';
import { overlay } from './overlay.js';
import type { OverlayOptions } from './overlay.js';
import { rovingFocus, preserveAttributes, isDisabled, emit } from './collection.js';
import { interactive } from './interactive.js';
import { createChevronDown } from './svg.js';
import { createSpring, motionPreset } from '@amiracle1024/motion';
export interface MenuOptions extends Omit<OverlayOptions, 'kind' | 'modal'> {
  anchor: HTMLElement;
  label?: string;
  closeOnSelect?: boolean;
  /** Append a decorative, animated chevron to the anchor. Defaults to false. */
  indicator?: boolean;
}
export function enhanceMenu(element: HTMLElement, initial: MenuOptions) {
  const scope = mount(element, 'eui-menu', ['role', 'aria-label']);
  let options = { ...initial };
  element.setAttribute('role', 'menu');
  if (options.label) element.setAttribute('aria-label', options.label);
  const controller = overlay(element, scope, { ...options, kind: 'menu', modal: false });
  preserveAttributes(scope, options.anchor, ['aria-haspopup', 'aria-expanded', 'aria-controls']);
  options.anchor.setAttribute('aria-haspopup', 'menu');
  options.anchor.setAttribute('aria-controls', element.id);
  options.anchor.setAttribute('aria-expanded', 'false');
  let indicator: HTMLSpanElement | undefined;
  const hadTriggerClass = options.anchor.classList.contains('eui-menu-trigger');
  const rotation = createSpring(
    0,
    (angle) => {
      if (indicator) indicator.style.transform = `rotate(${angle}deg)`;
    },
    motionPreset(options.motionScheme, 'default.effects'),
  );
  function syncIndicator() {
    if (options.indicator) {
      if (!indicator) {
        indicator = document.createElement('span');
        indicator.className = 'eui-menu-indicator';
        indicator.setAttribute('aria-hidden', 'true');
        indicator.append(createChevronDown());
        (options.anchor.querySelector(':scope > .eui-content') ?? options.anchor).append(indicator);
      }
      options.anchor.classList.add('eui-menu-trigger');
      indicator.style.transform = `rotate(${rotation.value}deg)`;
      rotation.setTarget(controller.isOpen ? 180 : 0);
    } else {
      indicator?.remove();
      indicator = undefined;
      if (!hadTriggerClass) options.anchor.classList.remove('eui-menu-trigger');
    }
  }
  syncIndicator();
  scope.add(() => {
    rotation.destroy();
    indicator?.remove();
    if (!hadTriggerClass) options.anchor.classList.remove('eui-menu-trigger');
  });
  const items = () =>
    [...element.querySelectorAll<HTMLElement>('[data-menu-item]')].filter(
      (item) => item.closest('[role=menu]') === element,
    );
  const effects: ReturnType<typeof interactive>[] = [];
  for (const item of items()) {
    preserveAttributes(scope, item, [
      'role',
      'tabindex',
      'aria-checked',
      'data-pressed',
      'class',
      'style',
    ]);
    const kind = item.dataset.kind;
    item.setAttribute(
      'role',
      kind === 'checkbox' ? 'menuitemcheckbox' : kind === 'radio' ? 'menuitemradio' : 'menuitem',
    );
    if (kind === 'checkbox' || kind === 'radio')
      item.setAttribute('aria-checked', item.getAttribute('aria-checked') ?? 'false');
    if (item.tagName === 'BUTTON')
      effects.push(interactive(item as HTMLButtonElement, scope, options.motionScheme));
  }
  const focus = rovingFocus(element, scope, items, { orientation: 'vertical', typeahead: true });
  scope.listen(element, 'eui-open', () => {
    options.anchor.setAttribute('aria-expanded', 'true');
    if (indicator) rotation.setTarget(180);
    focus.focus();
  });
  scope.listen(element, 'eui-close', () => {
    options.anchor.setAttribute('aria-expanded', 'false');
    if (indicator) rotation.setTarget(0);
  });
  scope.listen(element, 'eui-closing', () => options.anchor.setAttribute('aria-expanded', 'false'));
  scope.listen(element, 'eui-closing', () => {
    if (indicator) rotation.setTarget(0);
  });
  scope.listen(options.anchor, 'click', (event) =>
    queueMicrotask(() => {
      if (!scope.disposed && !event.defaultPrevented) controller.toggle();
    }),
  );
  scope.listen(options.anchor, 'keydown', (event) => {
    const e = event as KeyboardEvent;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      controller.open();
      focus.focus(
        e.key === 'ArrowUp'
          ? items()
              .filter((i) => !isDisabled(i))
              .at(-1)
          : undefined,
      );
    }
  });
  scope.listen(element, 'keydown', (event) => {
    const e = event as KeyboardEvent;
    if (e.key === 'Tab') controller.close('tab');
  });
  scope.listen(element, 'click', (event) => {
    const item = items().find(
      (item) => item === event.target || item.contains(event.target as Node),
    );
    if (!item || isDisabled(item)) return;
    queueMicrotask(() => {
      if (scope.disposed || event.defaultPrevented) return;
      if (item.dataset.kind === 'checkbox')
        item.setAttribute('aria-checked', String(item.getAttribute('aria-checked') !== 'true'));
      if (item.dataset.kind === 'radio') {
        for (const peer of items())
          if (peer.dataset.kind === 'radio' && peer.dataset.group === item.dataset.group)
            peer.setAttribute('aria-checked', String(peer === item));
      }
      if (
        !emit(
          element,
          'eui-select',
          {
            item,
            value: item.dataset.value ?? item.textContent?.trim(),
            checked: item.getAttribute('aria-checked') === 'true',
          },
          true,
        )
      )
        return;
      if (options.closeOnSelect !== false && !item.hasAttribute('data-submenu'))
        controller.close('select');
    });
  });
  return {
    element,
    open: controller.open,
    close: controller.close,
    toggle: controller.toggle,
    get isOpen() {
      return controller.isOpen;
    },
    refresh() {
      focus.refresh();
      controller.position();
    },
    update(next: Partial<Omit<MenuOptions, 'anchor'>>) {
      options = { ...options, ...next };
      syncIndicator();
      rotation.configure(motionPreset(options.motionScheme, 'default.effects'));
      for (const effect of effects) effect.configure(options.motionScheme ?? 'expressive');
      controller.configure(next);
    },
    destroy() {
      scope.dispose();
    },
  };
}
