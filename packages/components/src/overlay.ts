import { Scope, observeSize } from '@expressive-ui/core';
import { createSpring, motionPreset } from '@expressive-ui/motion';
import type { MotionScheme } from '@expressive-ui/motion';
import { focusableChildren, emit, preserveAttributes, uniqueId } from './collection.js';
interface Entry {
  surface: HTMLElement;
  anchor?: HTMLElement;
  modal: boolean;
  nativeModal: boolean;
  dismissible: boolean;
  close: (reason: string) => void;
}
const stacks = new WeakMap<
  Document,
  { entries: Entry[]; scope: Scope; inert: Map<HTMLElement, string | null> }
>();
function reconcileInert(stack: { entries: Entry[]; inert: Map<HTMLElement, string | null> }) {
  for (const [node, before] of stack.inert)
    if (before === null) node.removeAttribute('inert');
    else node.setAttribute('inert', before);
  stack.inert.clear();
  const modal = [...stack.entries].reverse().find((entry) => entry.modal);
  // Native modal dialogs already make the background inert. Do not mutate page
  // landmarks a second time: their CSS and observers must remain untouched.
  if (!modal || modal.nativeModal) return;
  const allowed = stack.entries.slice(stack.entries.indexOf(modal));
  let node: HTMLElement | null = modal.surface;
  while (node?.parentElement) {
    for (const sibling of node.parentElement.children)
      if (
        sibling !== node &&
        sibling instanceof HTMLElement &&
        !sibling.hasAttribute('data-eui-scrim') &&
        !allowed.some(
          (entry) =>
            sibling === entry.surface || (sibling.contains(entry.surface) && entry !== modal),
        )
      ) {
        stack.inert.set(sibling, sibling.getAttribute('inert'));
        sibling.inert = true;
      }
    node = node.parentElement;
    if (node === modal.surface.ownerDocument.body) break;
  }
}
function register(entry: Entry) {
  const document = entry.surface.ownerDocument;
  let stack = stacks.get(document);
  if (!stack) {
    const scope = new Scope();
    stack = { entries: [], scope, inert: new Map() };
    stacks.set(document, stack);
    const current = stack;
    scope.listen(document, 'keydown', (event) => {
      const e = event as KeyboardEvent,
        top = current.entries.at(-1);
      if (!top) return;
      if (e.key === 'Escape' && top.dismissible) {
        e.preventDefault();
        e.stopPropagation();
        top.close('escape');
      } else if (e.key === 'Tab') {
        const modal = [...current.entries].reverse().find((entry) => entry.modal);
        if (!modal) return;
        const nodes = focusableChildren(modal.surface),
          first = nodes[0],
          last = nodes.at(-1);
        if (!first) {
          e.preventDefault();
          modal.surface.focus();
        } else if (
          e.shiftKey &&
          (document.activeElement === first || !modal.surface.contains(document.activeElement))
        ) {
          e.preventDefault();
          last?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last || !modal.surface.contains(document.activeElement))
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    });
    scope.listen(document, 'focusin', (event) => {
      const modal = [...current.entries].reverse().find((e) => e.modal);
      if (
        modal &&
        !current.entries
          .slice(current.entries.indexOf(modal))
          .some((e) => e.surface.contains(event.target as Node))
      )
        (focusableChildren(modal.surface)[0] ?? modal.surface).focus();
    });
    scope.listen(
      document,
      'pointerdown',
      (event) => {
        const top = current.entries.at(-1);
        if (!top || top.modal || !top.dismissible) return;
        const path = event.composedPath();
        if (!path.includes(top.surface) && (!top.anchor || !path.includes(top.anchor)))
          top.close('outside');
      },
      { capture: true },
    );
  }
  stack.entries.push(entry);
  reconcileInert(stack);
  return () => {
    const index = stack.entries.indexOf(entry);
    if (index >= 0) stack.entries.splice(index, 1);
    reconcileInert(stack);
    if (!stack.entries.length) {
      stack.scope.dispose();
      stacks.delete(document);
    }
  };
}
const scrollLocks = new WeakMap<Document, { count: number; restore: () => void }>();
function lockScroll(document: Document) {
  let state = scrollLocks.get(document);
  if (!state) {
    const root = document.documentElement,
      window = document.defaultView!;
    const properties = ['overflow', 'padding-inline-end', 'scrollbar-gutter', 'scroll-behavior'];
    const before = properties.map(
      (name) =>
        [name, root.style.getPropertyValue(name), root.style.getPropertyPriority(name)] as const,
    );
    const scrollbar = Math.max(0, window.innerWidth - root.clientWidth);
    const stableGutter = typeof CSS !== 'undefined' && CSS.supports('scrollbar-gutter', 'stable');
    if (stableGutter) root.style.setProperty('scrollbar-gutter', 'stable');
    else if (scrollbar > 0) {
      const padding = parseFloat(getComputedStyle(root).paddingInlineEnd) || 0;
      root.style.setProperty('padding-inline-end', `${padding + scrollbar}px`);
    }
    root.style.setProperty('scroll-behavior', 'auto');
    state = {
      count: 0,
      restore() {
        for (const [name, value, priority] of before)
          if (value) root.style.setProperty(name, value, priority);
          else root.style.removeProperty(name);
      },
    };
    scrollLocks.set(document, state);
    root.style.setProperty('overflow', 'hidden');
  }
  state.count++;
  return () => {
    if (--state.count === 0) {
      state.restore();
      scrollLocks.delete(document);
    }
  };
}
export interface OverlayOptions {
  anchor?: HTMLElement;
  modal?: boolean;
  dismissible?: boolean;
  placement?: 'bottom-start' | 'bottom-end' | 'top' | 'top-end' | 'right' | 'left';
  motionScheme?: MotionScheme;
  restoreFocus?: boolean;
  maxHeight?: number;
  initialFocus?: HTMLElement | (() => HTMLElement | null);
  kind?:
    | 'dialog'
    | 'menu'
    | 'tooltip'
    | 'bottom-sheet'
    | 'side-sheet'
    | 'drawer'
    | 'search'
    | 'fab-menu';
}
export function overlay(surface: HTMLElement, parent: Scope, initial: OverlayOptions = {}) {
  const scope = new Scope();
  parent.add(() => scope.dispose());
  preserveAttributes(scope, surface, [
    'hidden',
    'style',
    'tabindex',
    'id',
    'data-open',
    'popover',
    'open',
  ]);
  if (!surface.id) surface.id = uniqueId('eui-overlay');
  if (!surface.hasAttribute('tabindex')) surface.tabIndex = -1;
  let options = { ...initial },
    opened = false,
    visible = false,
    previous: HTMLElement | null = null,
    active: Scope | undefined,
    native = false,
    popover = false;
  let backdrop: Animation | undefined;
  let fallbackScrim: HTMLElement | undefined;
  surface.hidden = true;
  surface.dataset.open = 'false';
  function position() {
    const anchor = options.anchor;
    if (!anchor || !visible) return;
    const a = anchor.getBoundingClientRect(),
      s = surface.getBoundingClientRect(),
      viewport = surface.ownerDocument.defaultView!;
    const surfaceWidth = surface.offsetWidth || s.width,
      surfaceHeight = surface.offsetHeight || s.height;
    const width = viewport.visualViewport?.width ?? viewport.innerWidth,
      height = viewport.visualViewport?.height ?? viewport.innerHeight;
    const rtl = getComputedStyle(anchor).direction === 'rtl';
    let x = rtl ? a.right - surfaceWidth : a.left,
      y = a.bottom + 4;
    if (options.placement === 'bottom-end') x = rtl ? a.left : a.right - surfaceWidth;
    else if (options.placement === 'top') {
      x = a.left + (a.width - surfaceWidth) / 2;
      y = a.top - surfaceHeight - 4;
    } else if (options.placement === 'top-end') {
      x = rtl ? a.left : a.right - surfaceWidth;
      y = a.top - surfaceHeight - 8;
    } else if (options.placement === 'right') {
      x = a.right + 4;
      y = a.top;
    } else if (options.placement === 'left') {
      x = a.left - surfaceWidth - 4;
      y = a.top;
    }
    if (y + surfaceHeight > height - 8 && a.top > surfaceHeight) y = a.top - surfaceHeight - 4;
    surface.style.position = 'fixed';
    surface.style.right = 'auto';
    surface.style.bottom = 'auto';
    surface.style.left = `${Math.max(8, Math.min(width - surfaceWidth - 8, x))}px`;
    surface.style.top = `${Math.max(8, Math.min(height - surfaceHeight - 8, y))}px`;
    surface.style.maxHeight = `${Math.min(options.maxHeight ?? Infinity, Math.max(64, height - 16))}px`;
  }
  function finishClose(reason: string) {
    if (opened || !visible) return;
    visible = false;
    active?.dispose();
    active = undefined;
    backdrop?.cancel();
    backdrop = undefined;
    fallbackScrim = undefined;
    if (native && (surface as HTMLDialogElement).open) (surface as HTMLDialogElement).close();
    if (!native) surface.removeAttribute('open');
    if (popover) {
      try {
        surface.hidePopover();
      } catch {
        /* Already hidden by platform. */
      }
    }
    surface.hidden = true;
    surface.dataset.open = 'false';
    if (options.restoreFocus !== false && previous?.isConnected && !previous.closest('[inert]'))
      previous.focus({ preventScroll: true });
    previous = null;
    emit(surface, 'eui-close', { reason });
  }
  let closingReason = 'programmatic';
  const alpha = createSpring(
    0,
    (value) => {
      surface.style.setProperty('--_eui-overlay-alpha', String(value));
      if (fallbackScrim) fallbackScrim.style.opacity = String(Math.max(0, Math.min(1, value)));
      if (backdrop) backdrop.currentTime = Math.max(0, Math.min(1, value)) * 1000;
      if (value === 0 && !opened) finishClose(closingReason);
    },
    motionPreset(options.motionScheme, 'fast.effects'),
  );
  const spatial = createSpring(
    0,
    (value) => {
      surface.style.setProperty('--_eui-overlay-progress', String(value));
      if (value === 0 && !opened) finishClose(closingReason);
    },
    motionPreset(options.motionScheme, 'default.spatial'),
  );
  scope.add(() => {
    active?.dispose();
    alpha.destroy();
    spatial.destroy();
    backdrop?.cancel();
    backdrop = undefined;
    if (native && (surface as HTMLDialogElement).open) (surface as HTMLDialogElement).close();
    if (popover)
      try {
        surface.hidePopover();
      } catch {}
    if (previous?.isConnected && options.restoreFocus !== false)
      previous.focus({ preventScroll: true });
  });
  function open() {
    if (scope.disposed || opened || !emit(surface, 'eui-beforeopen', undefined, true)) return;
    opened = true;
    surface.dataset.open = 'true';
    if (!visible) {
      visible = true;
      previous =
        surface.ownerDocument.activeElement instanceof HTMLElement
          ? surface.ownerDocument.activeElement
          : null;
      surface.hidden = false;
      active = new Scope();
      const window = surface.ownerDocument.defaultView!,
        scrollX = window.scrollX,
        scrollY = window.scrollY;
      if (options.modal) active.add(lockScroll(surface.ownerDocument));
      native =
        !!options.modal &&
        surface.tagName === 'DIALOG' &&
        typeof (surface as HTMLDialogElement).showModal === 'function';
      popover = !options.modal && typeof surface.showPopover === 'function';
      if (native) {
        try {
          (surface as HTMLDialogElement).showModal();
        } catch {
          native = false;
        }
      }
      if (native && typeof surface.animate === 'function') {
        try {
          const animation = surface.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: 1000,
            fill: 'both',
            pseudoElement: '::backdrop',
          });
          // cancel() rejects finished even while the animation is paused.
          void animation.finished.catch(() => {});
          if ((animation.effect as KeyframeEffect | null)?.pseudoElement === '::backdrop') {
            backdrop = animation;
            backdrop.pause();
            backdrop.currentTime = Math.max(0, Math.min(1, alpha.value)) * 1000;
          } else animation.cancel();
        } catch {
          /* Static native backdrop remains available. */
        }
      }
      if (popover) {
        surface.setAttribute('popover', 'manual');
        try {
          surface.showPopover();
        } catch {
          popover = false;
        }
      }
      if (options.modal) {
        if (!native) {
          surface.setAttribute('open', '');
          preserveAttributes(active, surface, ['aria-modal']);
          surface.setAttribute('aria-modal', 'true');
          const scrim = document.createElement('div');
          scrim.className = 'eui-overlay-scrim';
          scrim.dataset.euiScrim = '';
          scrim.setAttribute('aria-hidden', 'true');
          fallbackScrim = scrim;
          scrim.style.opacity = String(alpha.value);
          surface.before(scrim);
          active.add(() => scrim.remove());
          active.listen(scrim, 'click', () => {
            if (options.dismissible !== false) close('outside');
          });
        }
      }
      const entry: Entry = {
        surface,
        modal: options.modal ?? false,
        nativeModal: native,
        dismissible: options.dismissible !== false,
        close,
        ...(options.anchor ? { anchor: options.anchor } : {}),
      };
      active.add(register(entry));
      if (options.anchor) {
        const window = surface.ownerDocument.defaultView!;
        active.listen(window, 'resize', position);
        active.listen(window, 'scroll', position, { capture: true, passive: true });
        const size = observeSize(surface, position);
        active.add(() => size.destroy());
        const anchorSize = observeSize(options.anchor, position);
        active.add(() => anchorSize.destroy());
      }
      position();
      if (options.modal && (window.scrollX !== scrollX || window.scrollY !== scrollY))
        window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' });
    }
    alpha.setTarget(1);
    spatial.setTarget(1);
    if (options.kind !== 'tooltip') {
      const target =
        typeof options.initialFocus === 'function' ? options.initialFocus() : options.initialFocus;
      (
        target ??
        surface.querySelector<HTMLElement>('[autofocus]') ??
        focusableChildren(surface)[0] ??
        surface
      ).focus({ preventScroll: true });
    }
    emit(surface, 'eui-open');
  }
  function close(reason = 'programmatic') {
    if (scope.disposed || !opened || !emit(surface, 'eui-beforeclose', { reason }, true)) return;
    opened = false;
    closingReason = reason;
    surface.dataset.open = 'false';
    emit(surface, 'eui-closing', { reason });
    alpha.setTarget(0);
    spatial.setTarget(0);
    if (spatial.value === 0) finishClose(reason);
  }
  scope.listen(surface, 'cancel', (event) => {
    event.preventDefault();
    if (options.dismissible !== false) close('escape');
  });
  scope.listen(surface, 'close', () => {
    if (opened) {
      opened = false;
      finishClose('native');
    }
  });
  scope.listen(surface, 'click', (event) => {
    const closeButton = (event.target as Element).closest('[data-eui-close]');
    if (closeButton && surface.contains(closeButton)) {
      close('action');
      return;
    }
    if (options.modal && options.dismissible !== false && event.target === surface) {
      const e = event as MouseEvent,
        r = surface.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        close('outside');
    }
  });
  return {
    open,
    close,
    toggle() {
      if (opened) close();
      else open();
    },
    get isOpen() {
      return opened;
    },
    position,
    configure(next: Partial<OverlayOptions>) {
      options = { ...options, ...next };
      alpha.configure(motionPreset(options.motionScheme, 'fast.effects'));
      spatial.configure(motionPreset(options.motionScheme, 'default.spatial'));
      position();
    },
  };
}
