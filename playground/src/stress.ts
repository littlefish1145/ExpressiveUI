import '../../packages/components/src/styles.css';
import './stress.css';
import { Scope } from '@amiracle1024/core';
import { enhanceButton, enhanceLoadingIndicator, enhanceSelect } from '@amiracle1024/components';
import {
  createMorph,
  createShapeRenderer,
  getShape,
  alignContourTarget,
  signedArea,
  sampleCubics,
  emptyExperimentMetrics,
  recordContour,
  cubicPathDiscontinuity,
  cubicBoundaryDeviation,
} from '@amiracle1024/shape';
import {
  createSpring,
  createVectorState,
  createVectorSpring,
  motionPreset,
  solveSpring,
  sampleSpring,
  animateSpring,
  activeAnimationCount,
  getMotionPreference,
  observeReducedMotion,
} from '@amiracle1024/motion';
import { measureFrames } from './stress-metrics.js';
const scope = new Scope(),
  $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const frame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const preset = motionPreset('expressive', 'fast.spatial');
let run: Scope | undefined,
  serial = 0,
  finish: (() => void) | undefined;
let report: Record<string, unknown> = {};
const output = () => {
  $('result').textContent = JSON.stringify(report, null, 2);
};
function stop() {
  ++serial;
  finish?.();
  finish = undefined;
  run?.dispose();
  run = undefined;
  if (report.kind === '100 concurrent Loading components') {
    report.animationTasksAfter = activeAnimationCount();
    report.heapAfterDispose =
      (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
        ?.usedJSHeapSize ?? null;
    output();
  }
  $('load-stage').replaceChildren();
  $('shape').replaceChildren();
}
function begin(kind: string) {
  stop();
  run = new Scope();
  const id = serial;
  const metrics = emptyExperimentMetrics();
  report = {
    version: 2,
    ...metrics,
    measurementNotes: {
      unobserved:
        'null means not sampled or not applicable; interrupted runs preserve only observed data',
    },
    kind,
    engine: $<HTMLSelectElement>('browser-label').value,
    createdAt: new Date().toISOString(),
    preset,
    motionPreference: getMotionPreference(),
    dpr: devicePixelRatio,
  };
  const reduced = observeReducedMotion(() => {});
  report.reducedMotion = reduced.matches;
  run.add(() => reduced.destroy());
  $('status').textContent = '运行中：' + kind;
  output();
  return { id, owner: run, metrics };
}
for (const button of document.querySelectorAll<HTMLButtonElement>('button')) {
  const c = enhanceButton(button);
  scope.add(() => c.destroy());
}
for (const select of document.querySelectorAll<HTMLSelectElement>('select')) {
  const c = enhanceSelect(select);
  scope.add(() => c.destroy());
}
scope.listen($('stop'), 'click', () => {
  stop();
  $('status').textContent = '已停止并释放本轮资源';
});
scope.listen($('reverse'), 'click', () => void reverse());
async function reverse() {
  const { id, owner, metrics } = begin('100 reversals · official matched cubics');
  const pairs = await Promise.all(
    ['cookie9Sided', 'flower'].map(async (shape) => {
      const p = createMorph('circle', shape as 'flower');
      await p.ready;
      return p;
    }),
  );
  if (id !== serial) return;
  const measured = await measureFrames(owner, metrics.performance);
  if (id !== serial) return;
  finish = () => {
    report.sampling = measured.refresh();
    measured.stop();
    output();
  };
  const references = pairs.map((pair) => {
    const from = pair.cubicsAt(0)!.slice(),
      to = pair.cubicsAt(1)!.slice();
    return { from, to, expected: new Float64Array(from.length) };
  });
  let reference = references[0]!;
  const renderer = createShapeRenderer($('shape'));
  owner.add(() => renderer.destroy());
  let current = pairs[0]!,
    value = 0,
    nonfinite = 0,
    minArea = Infinity;
  const spring = createSpring(
    0,
    (v) => {
      value = v;
      const started = performance.now();
      const cubics = current.cubicsAt(v)!;
      const points = sampleCubics(cubics, 128);
      measured.geometry.add(performance.now() - started);
      if (!points.every(Number.isFinite)) nonfinite++;
      minArea = Math.min(minArea, signedArea(points));
      recordContour(metrics.geometry, points);
      if (points.every(Number.isFinite)) {
        for (let i = 0; i < cubics.length; i++)
          reference.expected[i] = reference.from[i]! + (reference.to[i]! - reference.from[i]!) * v;
        metrics.geometry.maxPathDiscontinuity = Math.max(
          metrics.geometry.maxPathDiscontinuity ?? 0,
          cubicPathDiscontinuity(cubics),
        );
        metrics.geometry.maxBoundaryDeviation = Math.max(
          metrics.geometry.maxBoundaryDeviation ?? 0,
          cubicBoundaryDeviation(cubics, reference.expected),
        );
      }
      renderer.drawCubics(cubics);
    },
    preset,
  );
  owner.add(() => spring.destroy());
  let lastTargetTime = 0;
  for (let group = 0; group < 2; group++) {
    current = pairs[group]!;
    reference = references[group]!;
    spring.jump(0);
    for (let i = 0; i < 100; i++) {
      if (id !== serial) return;
      const position = spring.value,
        velocity = spring.velocity,
        target = i % 2 === 0 ? 1 : 0;
      spring.setTarget(target);
      metrics.motion.maxPositionJump = Math.max(
        metrics.motion.maxPositionJump ?? 0,
        Math.abs(position - spring.value),
      );
      metrics.motion.maxVelocityJump = Math.max(
        metrics.motion.maxVelocityJump ?? 0,
        Math.abs(velocity - spring.velocity),
      );
      metrics.motion.finalTarget = target;
      lastTargetTime = measured.foregroundMs;
      await delay(24);
    }
  }
  while (id === serial && spring.running && measured.foregroundMs - lastTargetTime < 5000)
    await frame();
  if (id !== serial) return;
  if (!spring.running) metrics.motion.settlingTimeMs = measured.foregroundMs - lastTargetTime;
  report = {
    ...report,
    reversalsPerPair: 100,
    pairs: ['circle ↔ cookie9Sided', 'circle ↔ flower'],
    nonfinite,
    minArea,
    finalProgress: value,
    animations: activeAnimationCount(),
    measurementNotes: {
      geometryUnits: 'normalized coordinates; area in normalized squared units',
      pathDiscontinuity: 'C0 join gap between adjacent cubics, including closure',
      boundaryReference:
        'sampled paired-parameter distance against direct interpolation of matched endpoint cubics; not browser pixels/Hausdorff',
      settlingTime: 'foreground elapsed from final target update, runtime thresholds; 5s limit',
      maxSolverError: 'null: reversal runtime has no independent fixed-time solver reference',
    },
    note: '负面积或非有限值是数值警报；视觉撕裂仍需人工观察。',
  };
  finish?.();
  finish = undefined;
  $('status').textContent = '100 次反向已完成（每组）。可导出报告。';
}
scope.listen($('redirect'), 'click', () => void redirect());
async function redirect() {
  const { id, owner, metrics } = begin('30% redirect + resize · sampled interruption');
  const measured = await measureFrames(owner, metrics.performance);
  if (id !== serial) return;
  finish = () => {
    report.sampling = measured.refresh();
    measured.stop();
    output();
  };
  const renderer = createShapeRenderer($('shape'));
  owner.add(() => renderer.destroy());
  const vector = createVectorSpring(
    getShape('circle', 100, 100, 128),
    (points) => {
      recordContour(metrics.geometry, points);
      renderer.draw(points);
    },
    preset,
  );
  owner.add(() => vector.destroy());
  vector.jump(vector.value);
  const origin = vector.value.slice();
  let computeStart = performance.now();
  const firstTarget = alignContourTarget(vector.value, getShape('cookie9Sided', 100, 100, 128));
  measured.geometry.add(performance.now() - computeStart);
  vector.setTarget(firstTarget);
  const rootStart = performance.now();
  let redirected = false,
    redirectedTime = 0;
  let finalTarget: Float64Array | undefined;
  const observer = new ResizeObserver(() => {
    report.lastSize = { width: $('shape').clientWidth, height: $('shape').clientHeight };
  });
  observer.observe($('shape'));
  owner.add(() => observer.disconnect());
  while (id === serial) {
    const t = ((await frame()) - rootStart) / 1000;
    let numerator = 0,
      denominator = 0;
    for (let i = 0; i < origin.length; i++) {
      const delta = firstTarget[i]! - origin[i]!;
      numerator += (vector.value[i]! - origin[i]!) * delta;
      denominator += delta * delta;
    }
    const progress = denominator ? numerator / denominator : 1;
    if (!redirected && progress >= 0.3) {
      redirected = true;
      const before = vector.value.slice(),
        velocity = vector.velocity.slice();
      computeStart = performance.now();
      finalTarget = alignContourTarget(vector.value, getShape('flower', 100, 100, 128));
      measured.geometry.add(performance.now() - computeStart);
      vector.setTarget(finalTarget);
      report.positionJump = Math.max(...before.map((x, i) => Math.abs(x - vector.value[i]!)));
      report.velocityJump = Math.max(...velocity.map((x, i) => Math.abs(x - vector.velocity[i]!)));
      metrics.motion.maxPositionJump = report.positionJump as number;
      metrics.motion.maxVelocityJump = report.velocityJump as number;
      metrics.motion.finalTarget = [...finalTarget];
      redirectedTime = measured.foregroundMs;
      report.redirectedAt = { time: t, progress };
      $('shape').style.width = '240px';
      $('shape').style.height = '140px';
      owner.add(() => {
        $('shape').style.removeProperty('width');
        $('shape').style.removeProperty('height');
      });
    }
    if (redirected && finalTarget) {
      const resting = vector.value.every(
        (value, i) =>
          Math.hypot(value - finalTarget![i]!, vector.velocity[i]! / Math.sqrt(preset.stiffness)) <=
            (preset.positionThreshold ?? 0.001) &&
          Math.abs(vector.velocity[i]!) <= (preset.velocityThreshold ?? 0.01),
      );
      if (resting) {
        metrics.motion.settlingTimeMs = measured.foregroundMs - redirectedTime;
        let deviation = 0;
        for (let i = 0; i < finalTarget.length; i += 2)
          deviation = Math.max(
            deviation,
            Math.hypot(
              vector.value[i]! - finalTarget[i]!,
              vector.value[i + 1]! - finalTarget[i + 1]!,
            ),
          );
        metrics.geometry.maxBoundaryDeviation = deviation;
        break;
      }
    }
    if (measured.foregroundMs > 8000) break;
  }
  if (id !== serial) return;
  report.note =
    '归一化几何坐标和速度在重定向瞬间保持；容器尺寸变化会改变像素坐标，这是布局变化，不伪装成像素速度连续。可以运行中手动缩放窗口。';
  report.measurementNotes = {
    maxPathDiscontinuity: 'null: polygon uses implicit closed edges, no cubic seams',
    maxBoundaryDeviation:
      'endpoint paired-vertex error against final aligned contour, measured only on settlement',
    settlingTime: 'foreground elapsed since redirect; 8s experiment limit',
    geometryComputeP95:
      'two target construction/alignment timings; solver and diagnostics excluded',
    maxSolverError: 'null: no independent fixed-time reference in redirected runtime',
  };
  finish?.();
  finish = undefined;
  $('status').textContent = '30% 重定向完成';
}
scope.listen($('load'), 'click', () => void load());
async function load() {
  const { id, owner, metrics } = begin('100 concurrent Loading components');
  const measured = await measureFrames(owner, metrics.performance);
  if (id !== serial) return;
  const before = activeAnimationCount();
  const heap = () =>
    (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ??
    null;
  const heapBefore = heap(),
    memory: { seconds: number; bytes: number | null }[] = [];
  let longTaskCount = 0,
    longTaskMs = 0,
    blockingMs = 0;
  const longTaskSupported =
    typeof PerformanceObserver !== 'undefined' &&
    PerformanceObserver.supportedEntryTypes?.includes('longtask');
  if (longTaskSupported) {
    const observe = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTaskCount++;
        longTaskMs += entry.duration;
        blockingMs += Math.max(0, entry.duration - 50);
      }
    });
    observe.observe({ type: 'longtask' });
    owner.add(() => observe.disconnect());
  }
  const baseline = performance.now();
  for (let i = 0; i < 100; i++) {
    if (id !== serial) return;
    const node = document.createElement('div');
    $('load-stage').append(node);
    const c = enhanceLoadingIndicator(node, {
      label: `压力动画 ${i + 1}`,
      onGeometryMeasure: (ms) => measured.geometry.add(ms),
    });
    owner.add(() => c.destroy());
    if (i % 10 === 9) await delay(0);
  }
  $('load-stage').scrollIntoView({ block: 'center', behavior: 'instant' });
  const duration = Number($<HTMLSelectElement>('duration').value) * 1000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  owner.add(() => clearTimeout(timer));
  const update = () => {
    if (id !== serial) return;
    if (!document.hidden) {
      memory.push({ seconds: (performance.now() - baseline) / 1000, bytes: heap() });
      $('status').textContent =
        `100 个组件：前台运行 ${(measured.foregroundMs / 1000).toFixed(0)} / ${duration / 1000}s · 调度任务 ${activeAnimationCount()}`;
    }
    if (measured.foregroundMs >= duration) {
      stop();
      return;
    }
    timer = setTimeout(update, 1000);
  };
  finish = () => {
    const sampling = measured.refresh();
    report.sampling = sampling;
    measured.stop();
    report = {
      ...report,
      frames: sampling.frames,
      foregroundSeconds: measured.foregroundMs / 1000,
      frameMs: {
        p50: metrics.performance.frameTimeP50,
        p95: metrics.performance.frameTimeP95,
        p99: metrics.performance.frameTimeP99,
        max: metrics.performance.maxFrameTime,
      },
      heapBefore,
      memory,
      animationTasksBefore: before,
      animationTasksDuring: activeAnimationCount(),
      longTaskSupported,
      longTaskCount,
      longTaskMs,
      observedBlockingMs: blockingMs,
      measurementNotes: {
        geometry: 'null: no O(n²) shape diagnostics in the 100-component performance run',
        motion:
          'null: continuously looping components have no finite final target or settling time',
        droppedFrames: 'estimate based on measured idle cadence; hidden intervals excluded',
      },
      note: 'rAF间隔包含调度与绘制等待，不等于纯CPU耗时；帧统计保留最近36000帧；堆采样仅部分浏览器提供，未强制GC，不能据此证明无泄漏。所有100项需在视口附近，后台时间不计入运行时长。',
    };
    output();
    finish = undefined;
  };
  timer = setTimeout(update, 1000);
}
scope.listen($('trace'), 'click', () => void trace());
async function trace() {
  const { id, owner, metrics } = begin('fixed-time JS / WAAPI spring samples');
  const measured = await measureFrames(owner, metrics.performance);
  if (id !== serial) return;
  finish = () => {
    report.sampling = measured.refresh();
    measured.stop();
    output();
  };
  const node = $('shape');
  const controller = animateSpring(node, (v) => ({ transform: `translateX(${v * 200}px)` }), {
    ...preset,
    from: 0,
    to: 1,
  });
  owner.add(() => {
    controller.destroy();
    node.style.removeProperty('transform');
  });
  controller.pause();
  const animation = node.getAnimations()[0];
  const { duration } = sampleSpring(0, 1, preset);
  const samples = [];
  const stepped = createVectorState([0], preset);
  stepped.retarget([1]);
  let steppedTime = 0;
  for (const time of [0, 1 / 60, 0.05, 0.1, 0.2, 0.3, 0.5, 0.8]) {
    if (id !== serial) return;
    const t = Math.min(time, duration);
    if (animation) animation.currentTime = t * 1000;
    await frame();
    const transform = getComputedStyle(node).transform;
    const actual = animation
      ? new DOMMatrixReadOnly(transform === 'none' ? undefined : transform).m41 / 200
      : null;
    const js = solveSpring(0, 1, 0, t, preset).value;
    while (steppedTime < t - 1e-12) {
      const dt = Math.min(1 / 120, t - steppedTime);
      stepped.step(dt);
      steppedTime += dt;
    }
    const expectedVelocity = solveSpring(0, 1, 0, t, preset).velocity;
    metrics.motion.maxSolverError = Math.max(
      metrics.motion.maxSolverError ?? 0,
      Math.abs(stepped.positions[0]! - js),
      Math.abs(stepped.velocities[0]! - expectedVelocity),
    );
    samples.push({
      time: t,
      js,
      waapi: actual,
      error: actual === null ? null : Math.abs(actual - js),
    });
  }
  report = {
    ...report,
    samples,
    waapiAvailable: !!animation,
    measurementNotes: {
      geometry: 'null: transform-only trace has no geometry generation',
      settlingTimeMs: 'null: paused fixed-time sampling does not observe live settling',
      maxSolverError:
        'JS model at 120Hz steps vs closed-form at identical model times; WAAPI interpolation error remains separately in samples[].error',
    },
    note: 'WAAPI暂停后指定currentTime并读取transform；比较同一解析弹簧与线性采样关键帧的误差。不是自动跨浏览器测试。',
  };
  metrics.motion.finalTarget = 1;
  finish?.();
  finish = undefined;
  $('status').textContent = '轨迹已采样，可导出后换浏览器重复。';
}
scope.listen($('export'), 'click', () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = 'expressive-stress.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
});
scope.listen($('compare'), 'change', () => void compare());
async function compare() {
  const files = [...($<HTMLInputElement>('compare').files ?? [])];
  try {
    const traces = await Promise.all(files.map(async (file) => JSON.parse(await file.text())));
    if (traces.length < 2) throw Error('请选择至少两个报告');
    const reference = traces[0];
    if (!Array.isArray(reference.samples)) throw Error('请选择轨迹采样报告');
    const comparison = traces.slice(1).map((other) => {
      if (
        other.version !== reference.version ||
        JSON.stringify(other.preset) !== JSON.stringify(reference.preset) ||
        !Array.isArray(other.samples)
      )
        throw Error('版本、参数或报告类型不一致');
      let maxJS = 0,
        maxWAAPI: number | null = null;
      for (let i = 0; i < reference.samples.length; i++) {
        const a = reference.samples[i],
          b = other.samples[i];
        if (!b || Math.abs(a.time - b.time) > 1e-9) throw Error('采样时间不一致');
        maxJS = Math.max(maxJS, Math.abs(a.js - b.js));
        if (a.waapi !== null && b.waapi !== null)
          maxWAAPI = Math.max(maxWAAPI ?? 0, Math.abs(a.waapi - b.waapi));
      }
      return { reference: reference.engine, other: other.engine, maxJS, maxWAAPI };
    });
    $('comparison').textContent = JSON.stringify(comparison, null, 2);
  } catch (error) {
    $('comparison').textContent = String(error);
  }
}
scope.add(stop);
if (import.meta.hot) import.meta.hot.dispose(() => scope.dispose());
