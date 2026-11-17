import { mount } from './shared.js';
import { overlay } from './overlay.js';
import { preserveAttributes, rovingFocus } from './collection.js';
import { enhanceFab } from './fab.js';
import { interactive } from './interactive.js';
import type { MotionScheme } from '@epui/motion';
import { createSpring, motionPreset } from '@epui/motion';
export interface FabMenuOptions {
  anchor: HTMLButtonElement;
  label?: string;
  motionScheme?: MotionScheme;
}
export function enhanceFabMenu(host: HTMLElement, options: FabMenuOptions) {
  const scope = mount(host, 'eui-fab-menu', ['role', 'aria-label']);
  host.setAttribute('role', 'menu');
  if (options.label) host.setAttribute('aria-label', options.label);
  const fab = enhanceFab(options.anchor, { motionScheme: options.motionScheme ?? 'expressive' });
  scope.add(() => fab.destroy());
  const controller = overlay(host, scope, {
    anchor: options.anchor,
    kind: 'fab-menu',
    placement: 'top-end',
    motionScheme: options.motionScheme ?? 'expressive',
  });
  preserveAttributes(scope, options.anchor, ['aria-expanded', 'aria-controls', 'aria-haspopup']);
  options.anchor.setAttribute('aria-haspopup', 'menu');
  options.anchor.setAttribute('aria-controls', host.id);
  options.anchor.setAttribute('aria-expanded', 'false');
  const items = [...host.querySelectorAll<HTMLButtonElement>('button')];
  const effects: ReturnType<typeof interactive>[] = [];
  for (const [index, item] of items.entries()) {
    preserveAttributes(scope, item, ['role', 'class', 'data-pressed', 'style']);
    item.setAttribute('role', 'menuitem');
    item.style.setProperty('--_eui-fab-item-index', String(items.length - index - 1));
    effects.push(interactive(item, scope, options.motionScheme));
  }
  const icon = options.anchor.querySelector<HTMLElement>('[data-icon]');
  if (icon) preserveAttributes(scope, icon, ['style']);
  const rotation = createSpring(
    0,
    (value) => {
      if (icon) icon.style.transform = `rotate(${value}deg)`;
    },
    motionPreset(options.motionScheme, 'fast.spatial'),
  );
  scope.add(() => rotation.destroy());
  const focus = rovingFocus(host, scope, () => items, { orientation: 'vertical', typeahead: true });
  scope.listen(options.anchor, 'click', () => controller.toggle());
  scope.listen(host, 'eui-open', () => {
    options.anchor.setAttribute('aria-expanded', 'true');
    rotation.setTarget(45);
    focus.focus();
  });
  scope.listen(host, 'eui-close', () => options.anchor.setAttribute('aria-expanded', 'false'));
  scope.listen(host, 'eui-closing', () => {
    options.anchor.setAttribute('aria-expanded', 'false');
    rotation.setTarget(0);
  });
  scope.listen(host, 'click', (event) =>
    queueMicrotask(() => {
      if (
        !event.defaultPrevented &&
        items.some((i) => i === event.target || i.contains(event.target as Node))
      )
        controller.close('select');
    }),
  );
  return {
    element: host,
    open: controller.open,
    close: controller.close,
    get isOpen() {
      return controller.isOpen;
    },
    update(next: Partial<Omit<FabMenuOptions, 'anchor'>>) {
      Object.assign(options, next);
      const motionScheme = options.motionScheme ?? 'expressive';
      controller.configure({ motionScheme });
      fab.update({ motionScheme });
      rotation.configure(motionPreset(motionScheme, 'fast.spatial'));
      for (const effect of effects) effect.configure(motionScheme);
      if (next.label) host.setAttribute('aria-label', next.label);
    },
    destroy() {
      scope.dispose();
    },
  };
}
