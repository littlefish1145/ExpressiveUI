import { mount } from './shared.js';
import { overlay } from './overlay.js';
import type { OverlayOptions } from './overlay.js';
import { createSpring, motionPreset } from '@expressive-ui/motion';
export interface SheetOptions extends Omit<OverlayOptions, 'kind' | 'anchor'> {
  edge?: 'bottom' | 'start' | 'end';
  label?: string;
  dragHandle?: boolean;
}
export function enhanceSheet(element: HTMLElement, initial: SheetOptions = {}) {
  const scope = mount(element, 'eui-sheet', [
    'role',
    'aria-label',
    'aria-modal',
    'open',
    'data-edge',
    'data-modal',
  ]);
  let options = { ...initial };
  element.setAttribute('role', 'dialog');
  element.dataset.edge = options.edge ?? 'bottom';
  element.dataset.modal = String(options.modal !== false);
  if (options.label) element.setAttribute('aria-label', options.label);
  const controller = overlay(element, scope, {
    ...options,
    modal: options.modal !== false,
    kind: options.edge === 'bottom' ? 'bottom-sheet' : 'side-sheet',
  });
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'eui-sheet-handle';
  handle.setAttribute('aria-label', '关闭面板');
  handle.hidden =
    options.dragHandle === false ||
    (options.dragHandle === undefined && (options.edge ?? 'bottom') !== 'bottom');
  handle.dataset.euiClose = '';
  element.prepend(handle);
  scope.add(() => handle.remove());
  let drag: { id: number; y: number; x: number } | undefined;
  let suppressClick = false;
  const offset = createSpring(
    0,
    (value) => element.style.setProperty('--_eui-sheet-drag', `${Math.max(0, value)}px`),
    motionPreset(options.motionScheme, 'fast.spatial'),
  );
  scope.add(() => offset.destroy());
  function distance(e: PointerEvent, start: { x: number; y: number }) {
    if ((options.edge ?? 'bottom') === 'bottom') return e.clientY - start.y;
    const rtl = getComputedStyle(element).direction === 'rtl',
      sign = (options.edge === 'start' ? -1 : 1) * (rtl ? -1 : 1);
    return (e.clientX - start.x) * sign;
  }
  scope.listen(handle, 'click', (event) => {
    if (suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
    }
  });
  scope.listen(handle, 'pointerdown', (event) => {
    const e = event as PointerEvent;
    if (e.button !== 0) return;
    drag = { id: e.pointerId, y: e.clientY, x: e.clientX };
    suppressClick = false;
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {}
  });
  scope.listen(handle, 'pointermove', (event) => {
    const e = event as PointerEvent;
    if (!drag || e.pointerId !== drag.id) return;
    const delta = distance(e, drag);
    if (Math.abs(delta) > 3) suppressClick = true;
    offset.jump(Math.max(0, delta));
  });
  function end(event: Event) {
    const e = event as PointerEvent;
    if (!drag || drag.id !== e.pointerId) return;
    const delta = distance(e, drag);
    drag = undefined;
    if (e.type === 'pointerup' && delta > 64) controller.close('swipe');
    else offset.setTarget(0);
  }
  scope.listen(handle, 'pointerup', end);
  scope.listen(handle, 'pointercancel', end);
  scope.listen(element, 'eui-close', () => offset.jump(0));
  return {
    element,
    open: controller.open,
    close: controller.close,
    toggle: controller.toggle,
    get isOpen() {
      return controller.isOpen;
    },
    update(next: Partial<SheetOptions>) {
      options = { ...options, ...next };
      element.dataset.edge = options.edge ?? 'bottom';
      handle.hidden =
        options.dragHandle === false ||
        (options.dragHandle === undefined && (options.edge ?? 'bottom') !== 'bottom');
      offset.configure(motionPreset(options.motionScheme, 'fast.spatial'));
      controller.configure(next);
    },
    destroy() {
      scope.dispose();
    },
  };
}
