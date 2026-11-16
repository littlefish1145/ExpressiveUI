type Entry = { intersecting: boolean; listeners: Set<(visible: boolean) => void> };
const targets = new Map<Element, Entry>();
let observer: IntersectionObserver | undefined;
function visible(entry: Entry) {
  return entry.intersecting && !document.hidden;
}
function visibilityChanged() {
  for (const entry of targets.values())
    for (const listener of entry.listeners) listener(visible(entry));
}
/** One shared viewport observer and visibility listener, released with the last subscriber. */
export function observeViewport(element: Element, changed: (visible: boolean) => void) {
  if (typeof document === 'undefined')
    return {
      get visible() {
        return true;
      },
      destroy() {},
    };
  if (!targets.size) {
    document.addEventListener('visibilitychange', visibilityChanged);
    if (typeof IntersectionObserver !== 'undefined')
      observer = new IntersectionObserver(
        (entries) => {
          for (const record of entries) {
            const entry = targets.get(record.target);
            if (!entry || entry.intersecting === record.isIntersecting) continue;
            entry.intersecting = record.isIntersecting;
            for (const listener of entry.listeners) listener(visible(entry));
          }
        },
        { rootMargin: '128px' },
      );
  }
  let entry = targets.get(element);
  if (!entry) {
    entry = { intersecting: !observer, listeners: new Set() };
    targets.set(element, entry);
    observer?.observe(element);
  }
  entry.listeners.add(changed);
  let disposed = false;
  return {
    get visible() {
      return !disposed && visible(entry);
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      entry.listeners.delete(changed);
      if (!entry.listeners.size) {
        observer?.unobserve(element);
        targets.delete(element);
      }
      if (!targets.size) {
        observer?.disconnect();
        observer = undefined;
        document.removeEventListener('visibilitychange', visibilityChanged);
      }
    },
  };
}
