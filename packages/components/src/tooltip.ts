import { mount } from './shared.js';
import { overlay } from './overlay.js';
import { preserveAttributes } from './collection.js';
import type { MotionScheme } from '@epui/motion';
export interface TooltipOptions {
  anchor: HTMLElement;
  variant?: 'plain' | 'rich';
  delay?: number;
  motionScheme?: MotionScheme;
}
export function enhanceTooltip(element: HTMLElement, options: TooltipOptions) {
  const scope = mount(element, 'eui-tooltip', ['role', 'data-variant']);
  element.setAttribute('role', options.variant === 'rich' ? 'dialog' : 'tooltip');
  element.dataset.variant = options.variant ?? 'plain';
  const controller = overlay(element, scope, {
    anchor: options.anchor,
    kind: 'tooltip',
    placement: 'top',
    motionScheme: options.motionScheme ?? 'expressive',
    restoreFocus: false,
  });
  const original = options.anchor.getAttribute('aria-describedby');
  preserveAttributes(scope, options.anchor, ['aria-describedby']);
  options.anchor.setAttribute('aria-describedby', [original, element.id].filter(Boolean).join(' '));
  let timer: ReturnType<typeof setTimeout> | undefined,
    anchorHover = false,
    surfaceHover = false,
    focus = false;
  function hide() {
    clearTimeout(timer);
    if (!anchorHover && !surfaceHover && !focus) controller.close();
  }
  function show(delay = options.delay ?? 500) {
    clearTimeout(timer);
    timer = setTimeout(() => controller.open(), Math.max(0, delay));
  }
  scope.listen(options.anchor, 'pointerenter', (event) => {
    if ((event as PointerEvent).pointerType === 'touch') return;
    anchorHover = true;
    show();
  });
  scope.listen(options.anchor, 'pointerleave', () => {
    anchorHover = false;
    clearTimeout(timer);
    timer = setTimeout(hide, 100);
  });
  scope.listen(options.anchor, 'focus', () => {
    focus = true;
    show(0);
  });
  scope.listen(options.anchor, 'blur', () => {
    focus = false;
    hide();
  });
  scope.listen(element, 'pointerenter', () => {
    surfaceHover = true;
    clearTimeout(timer);
  });
  scope.listen(element, 'pointerleave', () => {
    surfaceHover = false;
    hide();
  });
  scope.add(() => clearTimeout(timer));
  return {
    element,
    show: controller.open,
    hide: controller.close,
    get isOpen() {
      return controller.isOpen;
    },
    update(next: Partial<Omit<TooltipOptions, 'anchor'>>) {
      Object.assign(options, next);
      element.dataset.variant = options.variant ?? 'plain';
      controller.configure({ motionScheme: options.motionScheme ?? 'expressive' });
    },
    destroy() {
      scope.dispose();
    },
  };
}
