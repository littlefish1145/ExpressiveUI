import { createSpring, motionPreset } from '@epui/motion';
import type { MotionScheme } from '@epui/motion';
import { mount } from './shared.js';
import { rovingFocus, preserveAttributes } from './collection.js';
import { observeSize } from '@epui/core';
import { animateColors } from './animated-styles.js';
export interface AppBarOptions {
  variant?:
    | 'small'
    | 'center'
    | 'center-aligned'
    | 'medium'
    | 'large'
    | 'medium-flex'
    | 'medium-flexible'
    | 'large-flex'
    | 'large-flexible'
    | 'bottom';
  subtitle?: string;
  titleAlignment?: 'start' | 'center';
  scrollTarget?: HTMLElement | Window;
  scrollBehavior?: 'pinned' | 'collapse' | 'hide';
  motionScheme?: MotionScheme;
}
export function enhanceAppBar(host: HTMLElement, initial: AppBarOptions = {}) {
  const scope = mount(host, 'eui-app-bar', [
    'data-variant',
    'data-scrolled',
    'data-scroll-behavior',
    'data-title-alignment',
    'data-expandable',
    'data-has-subtitle',
    'style',
  ]);
  let options = { ...initial },
    last = 0;
  const title = host.querySelector<HTMLElement>('[data-title]'),
    originalSubtitle = host.querySelector<HTMLElement>('[data-subtitle]');
  const originalSubtitleNodes = originalSubtitle ? [...originalSubtitle.childNodes] : [];
  if (originalSubtitle) preserveAttributes(scope, originalSubtitle, ['hidden', 'class', 'style']);
  const titleGroup = document.createElement('div');
  titleGroup.className = 'eui-app-bar-titles';
  const titlePlaceholder = title ? document.createComment('eui-app-bar-title') : undefined;
  if (title && titlePlaceholder) {
    title.before(titlePlaceholder);
    titleGroup.append(title);
    host.append(titleGroup);
  }
  let subtitle = originalSubtitle;
  const subtitlePlaceholder = subtitle ? document.createComment('eui-app-bar-subtitle') : undefined;
  if (subtitle && subtitlePlaceholder) {
    subtitle.before(subtitlePlaceholder);
    titleGroup.append(subtitle);
  }
  const ownedSubtitle = !subtitle;
  if (!subtitle) {
    subtitle = document.createElement('span');
    subtitle.dataset.subtitle = '';
    titleGroup.append(subtitle);
  }
  if (title) preserveAttributes(scope, title, ['class']);
  scope.add(() => {
    if (title && titlePlaceholder?.parentNode) titlePlaceholder.replaceWith(title);
    if (originalSubtitle && subtitlePlaceholder?.parentNode)
      subtitlePlaceholder.replaceWith(originalSubtitle);
    if (originalSubtitle && options.subtitle !== undefined)
      originalSubtitle.replaceChildren(...originalSubtitleNodes);
    if (ownedSubtitle) subtitle?.remove();
    titleGroup.remove();
  });
  let extraHeight = 0,
    collapse = 0;
  function configureLayout() {
    const requested = options.variant ?? 'small',
      variant =
        requested === 'center-aligned'
          ? 'center'
          : requested === 'medium-flexible'
            ? 'medium-flex'
            : requested === 'large-flexible'
              ? 'large-flex'
              : requested;
    host.dataset.variant = variant;
    const hasSubtitle =
      options.subtitle !== undefined ? !!options.subtitle : !!originalSubtitle?.textContent;
    host.dataset.hasSubtitle = String(hasSubtitle);
    if (options.subtitle !== undefined) subtitle!.textContent = options.subtitle;
    subtitle!.hidden = !hasSubtitle;
    const expanded =
      variant === 'medium-flex'
        ? hasSubtitle
          ? 136
          : 112
        : variant === 'large-flex'
          ? hasSubtitle
            ? 152
            : 120
          : variant === 'medium'
            ? 112
            : variant === 'large'
              ? 152
              : variant === 'bottom'
                ? 80
                : 64;
    extraHeight = Math.max(0, expanded - 64);
    host.dataset.expandable = String(extraHeight > 0 && variant !== 'bottom');
    host.dataset.titleAlignment =
      options.titleAlignment ?? (variant === 'center' ? 'center' : 'start');
    host.style.setProperty('--_eui-appbar-expanded-height', `${expanded}px`);
    const font =
        variant === 'medium-flex'
          ? 28
          : variant === 'large-flex'
            ? 36
            : variant === 'medium'
              ? 24
              : variant === 'large'
                ? 28
                : 22,
      line =
        variant === 'medium-flex'
          ? 36
          : variant === 'large-flex'
            ? 44
            : variant === 'medium'
              ? 32
              : variant === 'large'
                ? 36
                : 28;
    host.style.setProperty('--_eui-appbar-title-size', `${font}px`);
    host.style.setProperty('--_eui-appbar-title-line', `${line}px`);
    host.style.setProperty(
      '--_eui-appbar-subtitle-size',
      variant === 'large-flex' ? '16px' : '14px',
    );
    host.style.setProperty(
      '--_eui-appbar-subtitle-line',
      variant === 'large-flex' ? '24px' : '20px',
    );
    host.style.setProperty(
      '--_eui-appbar-title-bottom',
      variant === 'large' || variant === 'large-flex' ? '28px' : '24px',
    );
    host.style.setProperty(
      '--_eui-appbar-title-progress',
      String(extraHeight && variant !== 'bottom' ? collapse : 1),
    );
    const navigation =
        host.querySelector<HTMLElement>('[data-navigation]') ??
        ([...host.children].find((node) => node !== titleGroup && node.tagName === 'BUTTON') as
          HTMLElement | undefined),
      actions = host.querySelector<HTMLElement>('[data-actions]');
    const leading = navigation?.offsetWidth ?? 0,
      trailing = actions?.offsetWidth ?? 0;
    host.style.setProperty('--_eui-appbar-leading-space', `${leading ? leading + 8 : 0}px`);
    host.style.setProperty('--_eui-appbar-title-reserve', `${Math.max(leading, trailing) + 32}px`);
  }
  const progress = createSpring(
    0,
    (value) => {
      collapse = Math.max(0, Math.min(1, value));
      host.style.setProperty('--_eui-appbar-collapse', String(collapse));
      host.style.setProperty(
        '--_eui-appbar-title-progress',
        String(host.dataset.expandable === 'true' ? collapse : 1),
      );
    },
    motionPreset(options.motionScheme, 'fast.spatial'),
  );
  scope.add(() => progress.destroy());
  const colors = animateColors(
    host,
    [{ element: host, property: 'background-color' }],
    options.motionScheme,
  );
  scope.add(() => colors.destroy());
  let scrolled = false;
  function scroll() {
    host.dataset.scrollBehavior = options.scrollBehavior ?? 'pinned';
    const target = options.scrollTarget;
    const value =
      target instanceof HTMLElement
        ? target.scrollTop
        : ((target as Window | undefined)?.scrollY ?? 0);
    host.dataset.scrolled = String(value > 0);
    if (scrolled !== value > 0) {
      scrolled = value > 0;
      colors.refresh();
    }
    if (options.scrollBehavior === 'collapse')
      progress.setTarget(Math.max(0, Math.min(1, value / Math.max(1, extraHeight))));
    else if (options.scrollBehavior === 'hide')
      progress.setTarget(value > last && value > 64 ? 1 : 0);
    else progress.setTarget(0);
    last = value;
  }
  configureLayout();
  const size = observeSize(host, () => configureLayout());
  scope.add(() => size.destroy());
  if (options.scrollTarget) scope.listen(options.scrollTarget, 'scroll', scroll, { passive: true });
  scroll();
  return {
    element: host,
    refresh() {
      configureLayout();
      scroll();
    },
    update(next: Omit<Partial<AppBarOptions>, 'scrollTarget'>) {
      options = { ...options, ...next };
      configureLayout();
      progress.configure(motionPreset(options.motionScheme, 'fast.spatial'));
      colors.configure(options.motionScheme ?? 'expressive');
      colors.refresh();
      scroll();
    },
    destroy() {
      scope.dispose();
    },
  };
}
export interface ToolbarOptions {
  variant?: 'docked' | 'floating';
  orientation?: 'horizontal' | 'vertical';
  label?: string;
  motionScheme?: MotionScheme;
}
export function enhanceToolbar(host: HTMLElement, options: ToolbarOptions = {}) {
  const scope = mount(host, 'eui-toolbar', [
    'role',
    'aria-label',
    'aria-orientation',
    'data-variant',
  ]);
  host.setAttribute('role', 'toolbar');
  if (options.label) host.setAttribute('aria-label', options.label);
  host.setAttribute('aria-orientation', options.orientation ?? 'horizontal');
  host.dataset.variant = options.variant ?? 'floating';
  const focus = rovingFocus(
    host,
    scope,
    () => [...host.querySelectorAll<HTMLElement>('button,a[href],[role=button]')],
    { orientation: options.orientation ?? 'horizontal' },
  );
  return {
    element: host,
    refresh: focus.refresh,
    destroy() {
      scope.dispose();
    },
  };
}
