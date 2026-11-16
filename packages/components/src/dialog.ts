import { mount } from './shared.js';
import { overlay } from './overlay.js';
import type { OverlayOptions } from './overlay.js';
export interface DialogOptions extends Omit<OverlayOptions, 'modal' | 'kind' | 'anchor'> {
  label?: string;
  fullscreen?: boolean;
}
export function enhanceDialog(
  element: HTMLDialogElement | HTMLElement,
  options: DialogOptions = {},
) {
  const scope = mount(element, 'eui-dialog', [
    'role',
    'aria-label',
    'aria-modal',
    'open',
    'data-fullscreen',
  ]);
  if (element.tagName !== 'DIALOG') element.setAttribute('role', 'dialog');
  if (options.label) element.setAttribute('aria-label', options.label);
  element.dataset.fullscreen = String(options.fullscreen ?? false);
  const controller = overlay(element, scope, { ...options, modal: true, kind: 'dialog' });
  return {
    element,
    ...controller,
    get isOpen() {
      return controller.isOpen;
    },
    update(next: Partial<DialogOptions>) {
      controller.configure(next);
      if (next.label) element.setAttribute('aria-label', next.label);
      if (next.fullscreen !== undefined) element.dataset.fullscreen = String(next.fullscreen);
    },
    destroy() {
      scope.dispose();
    },
  };
}
