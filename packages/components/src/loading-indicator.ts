import {
  createMorph,
  createShapeRenderer,
  shapeRotationScale,
  cubicControlBounds,
} from '@amiracle1024/shape';
import type { PolygonShape, ShapeBackend } from '@amiracle1024/shape';
import { scheduleFrame, observeReducedMotion } from '@amiracle1024/motion';
import { loadingFrame } from './loading-model.js';
import { mount, decoration } from './shared.js';
import { observeViewport } from '@amiracle1024/core';
const sequence: PolygonShape[] = [
  'softBurst',
  'cookie9Sided',
  'pentagon',
  'pill',
  'sunny',
  'cookie4Sided',
  'oval',
];
export interface LoadingIndicatorOptions {
  label?: string;
  contained?: boolean;
  backend?: ShapeBackend;
  autoplay?: boolean;
  /** Optional diagnostics: geometry generation/normalization only, excludes DOM writes. */
  onGeometryMeasure?: (milliseconds: number) => void;
}
export function enhanceLoadingIndicator(
  element: HTMLElement,
  options: LoadingIndicatorOptions = {},
) {
  const scope = mount(element, 'eui-loading', ['role', 'aria-label', 'data-contained']);
  element.setAttribute('role', 'progressbar');
  element.setAttribute('aria-label', options.label ?? 'Loading');
  element.dataset.contained = String(options.contained ?? false);
  const rotation = decoration('eui-loading-rotation'),
    shape = decoration('eui-loading-shape');
  rotation.append(shape);
  element.append(rotation);
  const renderer = createShapeRenderer(shape, options.backend ?? 'svg');
  const morphs = sequence.map((from, i) =>
    createMorph(from, sequence[(i + 1) % sequence.length]!, { count: 128 }),
  );
  const radialScale = shapeRotationScale(sequence);
  let coordinates = new Float64Array(0);
  let total = 0,
    playing = options.autoplay ?? true,
    stop: (() => void) | undefined;
  let globalRotation: Animation | undefined;
  if (typeof rotation.animate === 'function') {
    globalRotation = rotation.animate(
      [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
      { duration: 4666, iterations: Infinity, easing: 'linear' },
    );
    void globalRotation.finished.catch(() => {});
    globalRotation.pause();
  }
  function draw(time: number) {
    const started = options.onGeometryMeasure ? performance.now() : 0;
    const state = loadingFrame(time),
      source = morphs[state.index]!.cubicsAt(state.progress)!;
    if (coordinates.length !== source.length) coordinates = new Float64Array(source.length);
    const bounds = cubicControlBounds(source),
      cx = (bounds.minX + bounds.maxX) / 2,
      cy = (bounds.minY + bounds.maxY) / 2;
    for (let i = 0; i < source.length; i += 2) {
      coordinates[i] = 0.5 + (source[i]! - cx) * radialScale;
      coordinates[i + 1] = 0.5 + (source[i + 1]! - cy) * radialScale;
    }
    options.onGeometryMeasure?.(performance.now() - started);
    renderer.drawCubics(coordinates);
    shape.style.transform = `rotate(${state.rotation}deg)`;
    if (!globalRotation) rotation.style.transform = `rotate(${(total / 4.666) * 360}deg)`;
  }
  const viewport = observeViewport(element, () => sync());
  scope.add(() => viewport.destroy());
  const reduced = observeReducedMotion(() => sync());
  scope.add(() => reduced.destroy());
  function halt() {
    stop?.();
    stop = undefined;
    globalRotation?.pause();
  }
  function sync() {
    halt();
    if (scope.disposed || !playing || reduced.matches || !viewport.visible) {
      if (reduced.matches) draw(0);
      return;
    }
    if (!document.hidden) globalRotation?.play();
    stop = scheduleFrame((dt) => {
      total += dt;
      draw(total);
      return true;
    });
  }
  scope.add(() => {
    halt();
    globalRotation?.cancel();
    renderer.destroy();
    rotation.remove();
  });
  draw(0);
  sync();
  return {
    element,
    backend: renderer.backend,
    get playing() {
      return playing;
    },
    pause() {
      if (scope.disposed) return;
      playing = false;
      halt();
    },
    play() {
      if (scope.disposed) return;
      playing = true;
      sync();
    },
    replay() {
      if (scope.disposed) return;
      total = 0;
      if (globalRotation) globalRotation.currentTime = 0;
      playing = true;
      draw(0);
      sync();
    },
    destroy() {
      scope.dispose();
    },
  };
}
