import { observeSize } from '@expressive-ui/core';
import { observeReducedMotion } from '@expressive-ui/motion';
import { mount } from './shared.js';
import { preserveAttributes, emit } from './collection.js';
export interface CarouselOptions {
  variant?: 'multi-browse' | 'uncontained' | 'hero';
  label?: string;
}
export function enhanceCarousel(host: HTMLElement, options: CarouselOptions = {}) {
  const scope = mount(host, 'eui-carousel', [
    'role',
    'aria-roledescription',
    'aria-label',
    'tabindex',
    'data-variant',
    'style',
  ]);
  host.setAttribute('role', 'region');
  host.setAttribute('aria-roledescription', 'carousel');
  if (options.label) host.setAttribute('aria-label', options.label);
  host.tabIndex = 0;
  host.dataset.variant = options.variant ?? 'multi-browse';
  const items = [...host.querySelectorAll<HTMLElement>('[data-carousel-item]')];
  let current = 0;
  for (const [index, item] of items.entries()) {
    preserveAttributes(scope, item, ['role', 'aria-roledescription', 'aria-label']);
    item.setAttribute('role', 'group');
    item.setAttribute('aria-roledescription', 'slide');
    if (!item.hasAttribute('aria-label'))
      item.setAttribute('aria-label', `${index + 1} / ${items.length}`);
  }
  const reduced = observeReducedMotion();
  scope.add(() => reduced.destroy());
  function goTo(index: number) {
    if (scope.disposed || !items.length) return;
    current = Math.max(0, Math.min(items.length - 1, index));
    const item = items[current]!;
    if (typeof item.scrollIntoView === 'function')
      item.scrollIntoView({
        block: 'nearest',
        inline: 'start',
        behavior: reduced.matches ? 'auto' : 'smooth',
      });
    emit(host, 'eui-change', { index: current });
  }
  scope.listen(host, 'keydown', (event) => {
    const e = event as KeyboardEvent;
    if (e.target !== host) return;
    const rtl = getComputedStyle(host).direction === 'rtl';
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      goTo(current + (e.key === 'ArrowRight' ? 1 : -1) * (rtl ? -1 : 1));
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      goTo(e.key === 'Home' ? 0 : items.length - 1);
    }
  });
  scope.listen(
    host,
    'scroll',
    () => {
      const h = host.getBoundingClientRect(),
        rtl = getComputedStyle(host).direction === 'rtl';
      let distance = Infinity,
        index = 0;
      for (let i = 0; i < items.length; i++) {
        const r = items[i]!.getBoundingClientRect(),
          d = Math.abs(rtl ? h.right - r.right : r.left - h.left);
        if (d < distance) {
          distance = d;
          index = i;
        }
      }
      if (current !== index) {
        current = index;
        emit(host, 'eui-change', { index });
      }
    },
    { passive: true },
  );
  const size = observeSize(host, (width) => {
    host.style.setProperty(
      '--_eui-carousel-item-size',
      `${Math.max(160, Math.min(320, width * 0.45))}px`,
    );
  });
  scope.add(() => size.destroy());
  return {
    element: host,
    goTo,
    next() {
      goTo(current + 1);
    },
    previous() {
      goTo(current - 1);
    },
    get index() {
      return current;
    },
    destroy() {
      scope.dispose();
    },
  };
}
