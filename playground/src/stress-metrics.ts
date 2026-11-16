import type { Scope } from '@amiracle1024/core';
import { sampleDistribution } from '@amiracle1024/shape';
import type { ExperimentMetrics } from '@amiracle1024/shape';

/** Idle cadence calibration and foreground rAF statistics. This is an estimate of dropped frames. */
export async function measureFrames(owner: Scope, metrics: ExperimentMetrics['performance']) {
  const intervals = sampleDistribution(),
    geometry = sampleDistribution(4096),
    calibration: number[] = [];
  let previous: number | undefined,
    request: number | undefined,
    stopped = false,
    activeMs = 0,
    baseline: number | null = null,
    dropped = 0;
  let readyResolve!: () => void;
  const ready = new Promise<void>((resolve) => {
    readyResolve = resolve;
  });
  const context = {
    frameIntervalMs: null as number | null,
    calibrationFrames: 30,
    droppedFramesMethod: 'estimated sum(max(0,round(dt/idleMedian)-1)); not compositor telemetry',
    frameWindow:
      'foreground rAF, 30-frame idle calibration excluded; quantiles retain last 36000 frames',
    geometryWindow:
      'geometry generation/normalization, before diagnostics and DOM writes; last 4096 samples',
  };
  function tick(now: number) {
    if (stopped) return;
    if (document.hidden) {
      previous = undefined;
    } else {
      if (previous !== undefined) {
        const dt = now - previous;
        if (dt > 0) {
          if (baseline === null) {
            calibration.push(dt);
            if (calibration.length === 30) {
              calibration.sort((a, b) => a - b);
              baseline = calibration[14]!;
              context.frameIntervalMs = baseline;
              readyResolve();
            }
          } else {
            intervals.add(dt);
            activeMs += dt;
            dropped += Math.max(0, Math.round(dt / baseline) - 1);
          }
        }
      }
      previous = now;
    }
    request = requestAnimationFrame(tick);
  }
  owner.listen(document, 'visibilitychange', () => {
    previous = undefined;
  });
  const refresh = () => {
    const stats = intervals.summary();
    Object.assign(metrics, {
      frameTimeP50: stats.p50,
      frameTimeP95: stats.p95,
      frameTimeP99: stats.p99,
      maxFrameTime: stats.max,
      droppedFrames: stats.count ? dropped : null,
      geometryComputeP95: geometry.summary().p95,
    });
    return {
      ...context,
      frames: stats.count,
      retainedFrames: stats.retained,
      geometrySamples: geometry.count,
      foregroundMs: activeMs,
    };
  };
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (request !== undefined) cancelAnimationFrame(request);
    refresh();
    readyResolve();
  };
  owner.add(stop);
  request = requestAnimationFrame(tick);
  await ready;
  return {
    context,
    geometry,
    refresh,
    stop,
    get foregroundMs() {
      return activeMs;
    },
  };
}
