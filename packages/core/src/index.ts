export { observeViewport } from './viewport.js';
/** Own every acquired resource. Cleanup is idempotent and runs in reverse order. */
export class Scope {
  #cleanups: (() => void)[] = [];
  #disposed = false;
  get disposed(): boolean {
    return this.#disposed;
  }
  get resourceCount(): number {
    return this.#cleanups.length;
  }
  add(cleanup: () => void): () => void {
    if (this.#disposed) cleanup();
    else this.#cleanups.push(cleanup);
    return cleanup;
  }
  listen(
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions,
  ): void {
    if (this.#disposed) return;
    target.addEventListener(type, listener, options);
    this.add(() => target.removeEventListener(type, listener, options));
  }
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    const errors: unknown[] = [];
    for (const cleanup of this.#cleanups.splice(0).reverse()) {
      try {
        cleanup();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, 'Resource cleanup failed');
  }
}

export function createStore<T>(initial: T) {
  let value = initial;
  const subscribers = new Set<(value: T) => void>();
  return {
    get: () => value,
    set(next: T) {
      if (Object.is(next, value)) return;
      value = next;
      for (const fn of subscribers) fn(value);
    },
    subscribe(fn: (value: T) => void) {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
    destroy() {
      subscribers.clear();
    },
  };
}

export interface Capabilities {
  clipPath: boolean;
  cssShape: boolean;
  cornerShape: boolean;
  property: boolean;
  waapi: boolean;
  svgPath: boolean;
  colorMix: boolean;
  popover: boolean;
  dialog: boolean;
}
/** Syntax/API detection only; never claims to detect platform rendering bugs. Safe during SSR. */
export function detectCapabilities(): Capabilities {
  const supports = (property: string, value: string) =>
    typeof CSS !== 'undefined' && CSS.supports(property, value);
  const element = typeof Element === 'undefined' ? undefined : Element.prototype;
  return {
    clipPath: supports('clip-path', 'polygon(0% 0%,100% 0%,50% 100%)'),
    cssShape: supports('clip-path', 'shape(from 0% 0%, line to 100% 0%, line to 50% 100%, close)'),
    cornerShape: supports('corner-shape', 'squircle'),
    property: typeof CSS !== 'undefined' && 'registerProperty' in CSS,
    waapi: !!element && typeof element.animate === 'function',
    svgPath:
      typeof document !== 'undefined' &&
      'getTotalLength' in document.createElementNS('http://www.w3.org/2000/svg', 'path'),
    colorMix: supports('color', 'color-mix(in srgb, black, white)'),
    popover: typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype,
    dialog: typeof HTMLDialogElement !== 'undefined' && 'showModal' in HTMLDialogElement.prototype,
  };
}

const preferences = new Map<
  string,
  {
    media: MediaQueryList | undefined;
    subscribers: Set<(matches: boolean) => void>;
    listener: () => void;
  }
>();
export function mediaPreference(query: string, changed?: (matches: boolean) => void) {
  let entry = preferences.get(query);
  if (!entry) {
    const media = typeof matchMedia === 'function' ? matchMedia(query) : undefined;
    const subscribers = new Set<(matches: boolean) => void>();
    const listener = () => {
      for (const subscriber of subscribers) subscriber(media?.matches ?? false);
    };
    entry = { media, subscribers, listener };
    preferences.set(query, entry);
    media?.addEventListener('change', listener);
  }
  // Each owner needs a distinct subscription even if callers reuse the same callback.
  const subscription = (matches: boolean) => changed?.(matches);
  entry.subscribers.add(subscription);
  let disposed = false;
  return {
    get matches() {
      return entry.media?.matches ?? false;
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      entry.subscribers.delete(subscription);
      if (!entry.subscribers.size) {
        entry.media?.removeEventListener('change', entry.listener);
        preferences.delete(query);
      }
    },
  };
}

export interface PressState {
  pressed: boolean;
}
/** No synthetic click: activation, keyboard, submission and disabled fieldsets stay native. */
export function bindPress(
  element: HTMLButtonElement | HTMLInputElement,
  changed: (state: PressState) => void,
  options: { cancelOnLeave?: boolean } = {},
): () => void {
  const scope = new Scope();
  let pointer: number | undefined;
  let pressed = false;
  const set = (value: boolean) => {
    if (pressed === value) return;
    pressed = value;
    changed({ pressed });
  };
  const disabled = () => element.disabled || element.matches(':disabled');
  scope.listen(element, 'pointerdown', (event) => {
    const e = event as PointerEvent;
    if (disabled() || e.button !== 0 || pointer !== undefined) return;
    pointer = e.pointerId;
    try {
      element.setPointerCapture(e.pointerId);
    } catch {
      /* Detached or synthetic event. */
    }
    set(true);
  });
  const release = () => {
    pointer = undefined;
    set(false);
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur'])
    scope.listen(element, type, release);
  scope.listen(element, 'pointerleave', () => {
    if (options.cancelOnLeave !== false && pointer !== undefined) release();
  });
  scope.listen(element, 'keydown', (event) => {
    const e = event as KeyboardEvent;
    if (!disabled() && (e.key === ' ' || (e.key === 'Enter' && element.tagName === 'BUTTON')))
      set(true);
  });
  scope.listen(element, 'keyup', (event) => {
    if ([' ', 'Enter'].includes((event as KeyboardEvent).key)) release();
  });
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => {
      if (disabled()) release();
    });
    observer.observe(element, { attributes: true, attributeFilter: ['disabled'] });
    const fieldset = element.closest('fieldset');
    if (fieldset) observer.observe(fieldset, { attributes: true, attributeFilter: ['disabled'] });
    scope.add(() => observer.disconnect());
  }
  return () => {
    scope.dispose();
    release();
  };
}

export function observeSize(element: Element, changed: (width: number, height: number) => void) {
  let lastWidth = -1,
    lastHeight = -1;
  const publish = (width: number, height: number, force = false) => {
    if (width <= 0 || height <= 0) return;
    if (!force && Math.abs(width - lastWidth) < 0.01 && Math.abs(height - lastHeight) < 0.01)
      return;
    lastWidth = width;
    lastHeight = height;
    changed(width, height);
  };
  const refresh = () => {
    const box = element.getBoundingClientRect();
    publish(box.width, box.height, true);
  };
  const observer =
    typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver((entries) => {
          const entry = entries[0];
          if (!entry) return;
          // Border box matches SVG decoration and includes padding, unlike contentRect.
          const box = entry.borderBoxSize?.[0];
          if (box && box.inlineSize > 0 && box.blockSize > 0)
            publish(box.inlineSize, box.blockSize);
          else {
            const box = element.getBoundingClientRect();
            publish(box.width, box.height);
          }
        });
  observer?.observe(element);
  refresh();
  return {
    refresh,
    destroy() {
      observer?.disconnect();
    },
  };
}
