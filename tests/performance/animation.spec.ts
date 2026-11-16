import { test, expect } from '@playwright/test';
test('animation frame and long task benchmark (report, no machine-specific FPS gate)', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await page.waitForFunction(() => !!window.expressive);
  const metrics = await page.evaluate(async () => {
    const longTasks: number[] = [];
    const observer =
      typeof PerformanceObserver === 'undefined'
        ? undefined
        : new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) longTasks.push(entry.duration);
          });
    if (PerformanceObserver.supportedEntryTypes.includes('longtask'))
      observer?.observe({ type: 'longtask' });
    const gaps: number[] = [];
    let previous = performance.now();
    const start = previous;
    performance.mark('expressive-bench-start');
    document.getElementById('morph-action')!.click();
    await new Promise<void>((resolve) => {
      function frame(now: number) {
        gaps.push(now - previous);
        previous = now;
        if (now - start >= 2500) resolve();
        else requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
    performance.mark('expressive-bench-end');
    performance.measure('expressive-bench', 'expressive-bench-start', 'expressive-bench-end');
    observer?.disconnect();
    gaps.sort((a, b) => a - b);
    return {
      frames: gaps.length,
      p50: gaps[Math.floor(gaps.length * 0.5)],
      p95: gaps[Math.floor(gaps.length * 0.95)],
      longTasks,
      elapsed: performance.getEntriesByName('expressive-bench')[0]!.duration,
      dpr: devicePixelRatio,
    };
  });
  await testInfo.attach('animation-metrics.json', {
    body: JSON.stringify(metrics, null, 2),
    contentType: 'application/json',
  });
  expect(metrics.frames).toBeGreaterThan(0);
  expect(metrics.elapsed).toBeGreaterThanOrEqual(2500);
});
