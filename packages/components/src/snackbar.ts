import { mount } from './shared.js';
import { Scope } from '@expressive-ui/core';
import { createSpring, motionPreset } from '@expressive-ui/motion';
import type { MotionScheme } from '@expressive-ui/motion';
export interface SnackbarMessage {
  message: string;
  action?: string;
  duration?: number;
  dismissLabel?: string;
}
export type SnackbarResult = 'action' | 'dismiss' | 'timeout' | 'destroyed';
export interface SnackbarOptions {
  motionScheme?: MotionScheme;
}
export function enhanceSnackbar(host: HTMLElement, options: SnackbarOptions = {}) {
  const scope = mount(host, 'eui-snackbar', [
    'role',
    'aria-live',
    'aria-atomic',
    'hidden',
    'style',
  ]);
  const nodes = [...host.childNodes];
  host.replaceChildren();
  host.setAttribute('role', 'status');
  host.setAttribute('aria-live', 'polite');
  host.setAttribute('aria-atomic', 'true');
  host.hidden = true;
  const label = document.createElement('span'),
    action = document.createElement('button'),
    dismiss = document.createElement('button');
  label.className = 'eui-snackbar-label';
  action.className = 'eui-snackbar-action';
  dismiss.className = 'eui-snackbar-dismiss';
  action.type = dismiss.type = 'button';
  dismiss.textContent = '×';
  host.append(label, action, dismiss);
  interface Pending {
    data: SnackbarMessage;
    resolve: (value: SnackbarResult) => void;
  }
  const queue: Pending[] = [];
  let visibleScope: Scope | undefined;
  let current: Pending | undefined,
    timer: ReturnType<typeof setTimeout> | undefined,
    start = 0,
    remaining = 0,
    paused = false,
    closing = false;
  const motion = createSpring(
    0,
    (value) => {
      host.style.setProperty('--_eui-snackbar-progress', String(value));
      if (value === 0 && closing) {
        closing = false;
        host.hidden = true;
        advance();
      }
    },
    motionPreset(options.motionScheme, 'fast.spatial'),
  );
  function schedule() {
    clearTimeout(timer);
    if (scope.disposed || !current || paused || remaining === Infinity) return;
    start = performance.now();
    timer = setTimeout(() => finish('timeout'), remaining);
  }
  function pause() {
    if (paused) return;
    paused = true;
    clearTimeout(timer);
    remaining = Math.max(0, remaining - (performance.now() - start));
  }
  function resume() {
    if (host.matches(':hover') || host.contains(document.activeElement)) return;
    paused = false;
    schedule();
  }
  function advance() {
    if (current || closing || scope.disposed) return;
    current = queue.shift();
    if (!current) return;
    visibleScope?.dispose();
    visibleScope = new Scope();
    visibleScope.listen(document, 'visibilitychange', () => {
      if (document.hidden) pause();
      else resume();
    });
    host.hidden = false;
    label.textContent = current.data.message;
    action.textContent = current.data.action ?? '';
    action.hidden = !current.data.action;
    dismiss.hidden = !current.data.dismissLabel;
    dismiss.setAttribute('aria-label', current.data.dismissLabel ?? '关闭通知');
    remaining = current.data.duration ?? (current.data.action ? 10000 : 4000);
    paused = false;
    motion.setTarget(1);
    schedule();
  }
  function finish(reason: SnackbarResult) {
    if (!current) return;
    clearTimeout(timer);
    const old = current;
    current = undefined;
    visibleScope?.dispose();
    visibleScope = undefined;
    old.resolve(reason);
    closing = true;
    motion.setTarget(0);
    if (motion.value === 0) {
      closing = false;
      host.hidden = true;
      advance();
    }
  }
  scope.listen(action, 'click', () => finish('action'));
  scope.listen(dismiss, 'click', () => finish('dismiss'));
  scope.listen(host, 'pointerenter', pause);
  scope.listen(host, 'pointerleave', resume);
  scope.listen(host, 'focusin', pause);
  scope.listen(host, 'focusout', () => queueMicrotask(resume));
  scope.add(() => {
    clearTimeout(timer);
    motion.destroy();
    visibleScope?.dispose();
    visibleScope = undefined;
    current?.resolve('destroyed');
    for (const pending of queue) pending.resolve('destroyed');
    host.replaceChildren(...nodes);
  });
  return {
    element: host,
    show(data: SnackbarMessage | string) {
      if (scope.disposed) return Promise.resolve('destroyed' as const);
      const message = typeof data === 'string' ? { message: data } : data;
      if (
        message.duration !== undefined &&
        message.duration !== Infinity &&
        (!Number.isFinite(message.duration) || message.duration < 0)
      )
        throw new RangeError('Nonnegative snackbar duration required');
      return new Promise<SnackbarResult>((resolve) => {
        queue.push({ data: message, resolve });
        advance();
      });
    },
    dismiss() {
      finish('dismiss');
    },
    get pending() {
      return queue.length + (current ? 1 : 0);
    },
    update(next: SnackbarOptions) {
      Object.assign(options, next);
      motion.configure(motionPreset(options.motionScheme, 'fast.spatial'));
    },
    destroy() {
      scope.dispose();
    },
  };
}
