import { createSpring, motionPreset } from '@expressive-ui/motion';
import type { MotionScheme } from '@expressive-ui/motion';
import { mount } from './shared.js';
import { preserveAttributes, rovingFocus, emit, isDisabled } from './collection.js';
import { interactive } from './interactive.js';
import { enhanceMenu } from './menu.js';
import { createChevronDown } from './svg.js';
export interface ButtonGroupOptions {
  connected?: boolean;
  selection?: 'none' | 'single' | 'multiple';
  label?: string;
  motionScheme?: MotionScheme;
}
export function enhanceButtonGroup(host: HTMLElement, initial: ButtonGroupOptions = {}) {
  const scope = mount(host, 'eui-button-group', ['role', 'aria-label', 'data-connected']);
  let options = { ...initial };
  host.setAttribute('role', 'group');
  if (options.label) host.setAttribute('aria-label', options.label);
  host.dataset.connected = String(options.connected ?? true);
  const items = [...host.querySelectorAll<HTMLButtonElement>('button[data-value]')],
    springs: ReturnType<typeof createSpring>[] = [];
  const effects: ReturnType<typeof interactive>[] = [];
  let rtl = getComputedStyle(host).direction === 'rtl';
  for (const [index, item] of items.entries()) {
    preserveAttributes(scope, item, [
      'class',
      'style',
      'aria-pressed',
      'data-selected',
      'data-pressed',
    ]);
    item.classList.add('eui-group-button');
    effects.push(interactive(item, scope, options.motionScheme));
    const spring = createSpring(
      8,
      (value) => {
        const outer = 20,
          first = index === 0,
          last = index === items.length - 1;
        item.style.borderRadius = rtl
          ? `${last ? outer : value}px ${first ? outer : value}px ${first ? outer : value}px ${last ? outer : value}px`
          : `${first ? outer : value}px ${last ? outer : value}px ${last ? outer : value}px ${first ? outer : value}px`;
      },
      motionPreset(options.motionScheme, 'default.effects'),
    );
    springs.push(spring);
    scope.add(() => spring.destroy());
    const observer = new MutationObserver(() => {
      const selected = item.getAttribute('aria-pressed') === 'true';
      item.dataset.selected = String(selected);
      spring.setTarget(item.dataset.pressed === 'true' ? 4 : selected ? 20 : 8);
    });
    observer.observe(item, { attributes: true, attributeFilter: ['data-pressed', 'aria-pressed'] });
    scope.add(() => observer.disconnect());
    spring.jump(item.getAttribute('aria-pressed') === 'true' ? 20 : 8);
    if (options.selection && options.selection !== 'none')
      item.setAttribute('aria-pressed', item.getAttribute('aria-pressed') ?? 'false');
  }
  const focus = rovingFocus(host, scope, () => items, { orientation: 'horizontal' });
  scope.listen(host, 'click', (event) => {
    const item = items.find((i) => i === event.target || i.contains(event.target as Node));
    if (!item || isDisabled(item) || !options.selection || options.selection === 'none') return;
    queueMicrotask(() => {
      if (scope.disposed || event.defaultPrevented) return;
      const selected = item.getAttribute('aria-pressed') !== 'true';
      if (options.selection === 'single')
        for (const peer of items) peer.setAttribute('aria-pressed', String(peer === item));
      else item.setAttribute('aria-pressed', String(selected));
      emit(host, 'eui-change', {
        values: items
          .filter((i) => i.getAttribute('aria-pressed') === 'true')
          .map((i) => i.dataset.value!),
      });
    });
  });
  return {
    element: host,
    refresh: focus.refresh,
    update(next: Partial<ButtonGroupOptions>) {
      options = { ...options, ...next };
      rtl = getComputedStyle(host).direction === 'rtl';
      for (const spring of springs)
        spring.configure(motionPreset(options.motionScheme, 'default.effects'));
      for (const effect of effects) effect.configure(options.motionScheme ?? 'expressive');
      host.dataset.connected = String(options.connected ?? true);
    },
    destroy() {
      scope.dispose();
    },
  };
}
export interface SplitButtonOptions {
  menu: HTMLElement;
  label?: string;
  motionScheme?: MotionScheme;
}
export function enhanceSplitButton(host: HTMLElement, options: SplitButtonOptions) {
  const scope = mount(host, 'eui-split-button', ['role', 'aria-label']);
  const buttons = [...host.querySelectorAll<HTMLButtonElement>(':scope > button')];
  if (buttons.length !== 2) throw new TypeError('Split button requires two direct native buttons');
  host.setAttribute('role', 'group');
  if (options.label) host.setAttribute('aria-label', options.label);
  const effects: ReturnType<typeof interactive>[] = [],
    contents: HTMLSpanElement[] = [];
  for (const [index, button] of buttons.entries()) {
    preserveAttributes(scope, button, ['class', 'data-pressed', 'style']);
    button.classList.add(index ? 'eui-split-trailing' : 'eui-split-leading');
    const content = document.createElement('span');
    content.className = index ? 'eui-split-icon' : 'eui-split-label';
    const originalNodes = [...button.childNodes],
      defaultIcon =
        index === 1 &&
        !button.querySelector('svg,img,[data-icon]') &&
        /^[⌄∨▾▼vV˅]?$/u.test(button.textContent?.trim() ?? '');
    if (defaultIcon) {
      for (const node of originalNodes) node.remove();
      content.append(createChevronDown(22));
    } else content.append(...originalNodes);
    button.append(content);
    contents.push(content);
    scope.add(() =>
      content.replaceWith(...(defaultIcon ? originalNodes : [...content.childNodes])),
    );
    effects.push(interactive(button, scope, options.motionScheme));
  }
  const menu = enhanceMenu(options.menu, {
    anchor: buttons[1]!,
    motionScheme: options.motionScheme ?? 'expressive',
  });
  scope.add(() => menu.destroy());
  const shape = createSpring(
    4,
    (value) => buttons[1]!.style.setProperty('--_eui-split-inner', `${Math.max(0, value)}px`),
    motionPreset(options.motionScheme, 'default.effects'),
  );
  scope.add(() => shape.destroy());
  const leadingShape = createSpring(
    4,
    (value) =>
      buttons[0]!.style.setProperty('--_eui-split-leading-inner', `${Math.max(0, value)}px`),
    motionPreset(options.motionScheme, 'default.effects'),
  );
  const rotation = createSpring(
    0,
    (value) => (contents[1]!.style.transform = `rotate(${value}deg)`),
    motionPreset(options.motionScheme, 'default.effects'),
  );
  scope.add(() => {
    leadingShape.destroy();
    rotation.destroy();
  });
  const hovered = [false, false];
  function syncShape() {
    for (const [index, button] of buttons.entries()) {
      const pressed = button.dataset.pressed === 'true',
        value = pressed || hovered[index] ? 12 : index === 1 && menu.isOpen ? 20 : 4;
      (index === 0 ? leadingShape : shape).setTarget(value);
    }
    rotation.setTarget(menu.isOpen ? 180 : 0);
  }
  for (const [index, button] of buttons.entries()) {
    scope.listen(button, 'pointerenter', (event) => {
      if ((event as PointerEvent).pointerType !== 'touch') {
        hovered[index] = true;
        syncShape();
      }
    });
    scope.listen(button, 'pointerleave', () => {
      hovered[index] = false;
      syncShape();
    });
  }
  const observer = new MutationObserver(syncShape);
  for (const button of buttons)
    observer.observe(button, { attributes: true, attributeFilter: ['data-pressed', 'disabled'] });
  scope.add(() => observer.disconnect());
  scope.listen(options.menu, 'eui-open', syncShape);
  scope.listen(options.menu, 'eui-close', syncShape);
  scope.listen(options.menu, 'eui-closing', syncShape);
  return {
    element: host,
    open: menu.open,
    close: menu.close,
    get isOpen() {
      return menu.isOpen;
    },
    update(next: Partial<Omit<SplitButtonOptions, 'menu'>>) {
      Object.assign(options, next);
      if (next.label) host.setAttribute('aria-label', next.label);
      if (next.motionScheme) {
        for (const effect of effects) effect.configure(next.motionScheme);
        for (const spring of [leadingShape, shape, rotation])
          spring.configure(motionPreset(next.motionScheme, 'default.effects'));
        menu.update({ motionScheme: next.motionScheme });
      }
    },
    destroy() {
      scope.dispose();
    },
  };
}
