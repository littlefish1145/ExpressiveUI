import { observeSize } from '@amiracle1024/core';
import { createSpring, motionPreset } from '@amiracle1024/motion';
import type { MotionScheme } from '@amiracle1024/motion';
import { mount } from './shared.js';
import { emit, focusableChildren } from './collection.js';
import { enhanceButton } from './button.js';
export interface BannerAction {
  label: string;
  onClick?: () => void;
  dismiss?: boolean;
}
export interface BannerOptions {
  message: string;
  icon?: Node | string;
  primaryAction?: BannerAction;
  secondaryAction?: BannerAction;
  open?: boolean;
  label?: string;
  motionScheme?: MotionScheme;
}
/** Persistent Material banner pattern using M3 color roles; not an Expressive token family. */
export function enhanceBanner(host: HTMLElement, initial: BannerOptions) {
  const scope = mount(host, 'eui-banner', ['role', 'aria-label', 'hidden', 'style', 'data-open']);
  const original = [...host.childNodes];
  host.replaceChildren();
  scope.add(() => host.replaceChildren(...original));
  let options = { ...initial },
    opened = initial.open !== false,
    height = 0;
  const content = document.createElement('div');
  content.className = 'eui-banner-content';
  const icon = document.createElement('span'),
    message = document.createElement('p'),
    actions = document.createElement('div');
  icon.className = 'eui-banner-icon';
  icon.setAttribute('aria-hidden', 'true');
  message.className = 'eui-banner-message';
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  actions.className = 'eui-banner-actions';
  const primary = document.createElement('button'),
    secondary = document.createElement('button');
  primary.type = secondary.type = 'button';
  actions.append(secondary, primary);
  content.append(icon, message, actions);
  host.append(content);
  host.setAttribute('role', 'region');
  const primaryLabel = document.createElement('span'),
    secondaryLabel = document.createElement('span');
  primary.append(primaryLabel);
  secondary.append(secondaryLabel);
  const primaryController = enhanceButton(primary, {
      variant: 'text',
      motionScheme: options.motionScheme ?? 'expressive',
    }),
    secondaryController = enhanceButton(secondary, {
      variant: 'text',
      motionScheme: options.motionScheme ?? 'expressive',
    });
  scope.add(() => {
    primaryController.destroy();
    secondaryController.destroy();
  });
  const motion = createSpring(
    opened ? 1 : 0,
    (value) => {
      host.style.setProperty('--_eui-banner-progress', String(Math.max(0, Math.min(1, value))));
      if (value === 0 && !opened) {
        host.hidden = true;
        emit(host, 'eui-close', { reason: 'dismiss' });
      }
    },
    motionPreset(options.motionScheme, 'default.spatial'),
  );
  scope.add(() => motion.destroy());
  function draw() {
    host.setAttribute('aria-label', options.label ?? '通知');
    message.textContent = options.message;
    icon.replaceChildren();
    if (options.icon instanceof Node) icon.append(options.icon);
    else icon.textContent = options.icon ?? '';
    icon.hidden = options.icon === undefined;
    primaryLabel.textContent = options.primaryAction?.label ?? '';
    secondaryLabel.textContent = options.secondaryAction?.label ?? '';
    primary.hidden = !options.primaryAction;
    secondary.hidden = !options.secondaryAction;
    primaryController.refresh();
    secondaryController.refresh();
  }
  function close(reason = 'dismiss') {
    if (scope.disposed || !opened || !emit(host, 'eui-beforeclose', { reason }, true)) return;
    if (host.contains(document.activeElement)) {
      const next =
        host.nextElementSibling instanceof HTMLElement
          ? focusableChildren(host.nextElementSibling)[0]
          : undefined;
      next?.focus({ preventScroll: true });
    }
    opened = false;
    host.dataset.open = 'false';
    motion.setTarget(0);
  }
  function open() {
    if (scope.disposed || opened || !emit(host, 'eui-beforeopen', undefined, true)) return;
    opened = true;
    host.hidden = false;
    host.dataset.open = 'true';
    host.style.setProperty('--_eui-banner-height', `${height || content.offsetHeight}px`);
    motion.setTarget(1);
    emit(host, 'eui-open');
  }
  scope.listen(primary, 'click', () => {
    const action = options.primaryAction;
    if (action && emit(host, 'eui-action', { action: 'primary' }, true)) {
      action.onClick?.();
      if (action.dismiss) close('action');
    }
  });
  scope.listen(secondary, 'click', () => {
    const action = options.secondaryAction;
    if (action && emit(host, 'eui-action', { action: 'secondary' }, true)) {
      action.onClick?.();
      if (action.dismiss !== false) close('action');
    }
  });
  draw();
  host.hidden = !opened;
  host.dataset.open = String(opened);
  host.style.setProperty('--_eui-banner-progress', opened ? '1' : '0');
  const size = observeSize(content, (_, h) => {
    if (h > 0) {
      height = h;
      host.style.setProperty('--_eui-banner-height', `${height}px`);
    }
  });
  scope.add(() => size.destroy());
  return {
    element: host,
    open,
    close,
    get isOpen() {
      return opened;
    },
    update(next: Partial<BannerOptions>) {
      if (scope.disposed) return;
      options = { ...options, ...next };
      draw();
      motion.configure(motionPreset(options.motionScheme, 'default.spatial'));
      for (const button of [primaryController, secondaryController])
        button.update({ motionScheme: options.motionScheme ?? 'expressive' });
      if (next.open !== undefined) {
        if (next.open) open();
        else close('programmatic');
      }
    },
    destroy() {
      scope.dispose();
    },
  };
}
