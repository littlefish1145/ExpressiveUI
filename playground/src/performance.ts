import type { Scope } from '@expressive-ui/core';
/** Local diagnostics only. No network reporting and no browser automation. */
export function observePagePerformance(scope: Scope) {
  let lcpMs = 0,
    cls = 0,
    sessionScore = 0,
    sessionStart = 0,
    lastShift = 0,
    longTasks = 0,
    blockingMs = 0;
  const shifts: { at: number; score: number; ids: string[] }[] = [];
  const supported =
    typeof PerformanceObserver === 'undefined'
      ? []
      : (PerformanceObserver.supportedEntryTypes ?? []);
  function observe(type: string, receive: (entry: PerformanceEntry) => void) {
    if (!supported.includes(type)) return;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) receive(entry);
    });
    observer.observe({ type, buffered: true });
    scope.add(() => observer.disconnect());
  }
  observe('largest-contentful-paint', (entry) => {
    lcpMs = entry.startTime;
  });
  observe('longtask', (entry) => {
    longTasks++;
    blockingMs += Math.max(0, entry.duration - 50);
  });
  observe('layout-shift', (entry) => {
    const shift = entry as PerformanceEntry & {
      value: number;
      hadRecentInput: boolean;
      sources?: { node?: Element }[];
    };
    if (shift.hadRecentInput) return;
    if (entry.startTime - lastShift > 1000 || entry.startTime - sessionStart > 5000) {
      sessionScore = 0;
      sessionStart = entry.startTime;
    }
    lastShift = entry.startTime;
    sessionScore += shift.value;
    cls = Math.max(cls, sessionScore);
    shifts.push({
      at: entry.startTime,
      score: shift.value,
      ids: (shift.sources ?? []).map(
        (source) => source.node?.id ?? source.node?.tagName ?? 'unknown',
      ),
    });
    if (shifts.length > 10) shifts.shift();
  });
  return () => ({
    supported,
    lcpMs,
    cls,
    longTasks,
    observedBlockingMs: Math.round(blockingMs),
    // The observation window differs from Lighthouse's TBT window.
    recentLayoutShifts: shifts.map((shift) => ({ ...shift, ids: [...shift.ids] })),
    navigation: performance.getEntriesByType('navigation')[0]?.toJSON(),
  });
}
