import {
  createSpring,
  motionPreset,
  observeReducedMotion,
  scheduleFrame,
} from '@expressive-ui/motion';
import type { MotionScheme } from '@expressive-ui/motion';
import { observeSize, observeViewport } from '@expressive-ui/core';
import { mount } from './shared.js';
import { svgElement } from './svg.js';
const clamp = (v: number) => Math.max(0, Math.min(1, v));
function bezier(x: number, x1: number, y1: number, x2: number, y2: number) {
  x = clamp(x);
  let lo = 0,
    hi = 1,
    t = x;
  for (let i = 0; i < 18; i++) {
    const value = 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t * t * x2 + t ** 3;
    if (value < x) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3;
}
/** Source-derived indeterminate keyframes; times are seconds. */
export function linearProgressFrame(seconds: number) {
  const time = ((seconds % 1.75) + 1.75) % 1.75;
  const value = (delay: number, duration: number) =>
    bezier((time - delay) / duration, 0.3, 0, 0.8, 0.15);
  return [
    { start: value(0.25, 1), end: value(0, 1) },
    { start: value(0.9, 0.85), end: value(0.65, 0.85) },
  ];
}
export function circularProgressFrame(seconds: number) {
  const time = ((seconds % 6) + 6) % 6,
    cycle = Math.floor(time / 1.5),
    phase = time - cycle * 1.5;
  const rotation = (time / 6) * 1080 + cycle * 90 + 90 * bezier(phase / 0.3, 0.05, 0.7, 0.1, 1);
  const p = time < 3 ? bezier(time / 3, 0.2, 0, 0, 1) : 1 - bezier((time - 3) / 3, 0.2, 0, 0, 1);
  return { rotation, progress: 0.1 + 0.77 * p };
}
export interface ProgressOptions {
  variant?: 'linear' | 'circular';
  value?: number | null;
  max?: number;
  label: string;
  buffer?: number;
  wavy?: boolean;
  motionScheme?: MotionScheme;
}
export function enhanceProgress(host: HTMLElement, initial: ProgressOptions) {
  const scope = mount(host, 'eui-progress', [
    'role',
    'aria-label',
    'aria-valuemin',
    'aria-valuemax',
    'aria-valuenow',
    'data-variant',
    'data-wavy',
  ]);
  let options = { ...initial },
    fraction = 0,
    time = 0,
    cancel: (() => void) | undefined,
    width = 240,
    playing = true;
  host.setAttribute('role', 'progressbar');
  const svg = svgElement('svg', {
      'aria-hidden': 'true',
      focusable: 'false',
      preserveAspectRatio: 'none',
    }),
    track = svgElement('path', {
      class: 'eui-progress-track',
      fill: 'none',
      'stroke-linecap': 'round',
    }),
    buffer = svgElement('path', {
      class: 'eui-progress-buffer',
      fill: 'none',
      'stroke-linecap': 'round',
    }),
    active = svgElement('path', {
      class: 'eui-progress-active',
      fill: 'none',
      'stroke-linecap': 'round',
    }),
    second = svgElement('path', {
      class: 'eui-progress-active',
      fill: 'none',
      'stroke-linecap': 'round',
    }),
    stop = svgElement('circle', { class: 'eui-progress-stop', r: 2 });
  svg.append(track, buffer, active, second, stop);
  host.append(svg);
  scope.add(() => svg.remove());
  const viewport = observeViewport(host, () => sync());
  scope.add(() => viewport.destroy());
  const reduced = observeReducedMotion(() => sync());
  scope.add(() => reduced.destroy());
  const spring = createSpring(
    0,
    (value) => {
      fraction = value;
      draw();
    },
    motionPreset(options.motionScheme, 'default.spatial'),
  );
  scope.add(() => spring.destroy());
  function line(start: number, end: number, wave = false) {
    const left = 2 + (width - 4) * clamp(start),
      right = 2 + (width - 4) * clamp(end);
    if (right <= left) return '';
    if (!wave) return `M${left} 5 H${right}`;
    let d = `M${left} 5`;
    for (let x = left + 1; x < right; x += 1) {
      const taper = Math.min(1, (x - left) / 6, (right - x) / 6);
      d += ` L${x} ${5 + 3 * taper * Math.sin(((x - time * 40) * Math.PI * 2) / (options.value == null ? 20 : 40))}`;
    }
    return d + ` L${right} 5`;
  }
  function arc(start: number, end: number, wave = false) {
    if (end <= start) return '';
    const radius = 18,
      points = Math.max(2, Math.ceil((end - start) * 180));
    let d = '';
    for (let i = 0; i <= points; i++) {
      const t = start + ((end - start) * i) / points,
        a = ((t * 360 - 90) * Math.PI) / 180,
        r = radius + (wave ? 1.6 * Math.sin(t * Math.PI * 24 - time * Math.PI * 2) : 0);
      d += `${i ? 'L' : 'M'}${20 + Math.cos(a) * r} ${20 + Math.sin(a) * r}`;
    }
    return d;
  }
  function draw() {
    if (scope.disposed) return;
    const circular = options.variant === 'circular',
      indeterminate = options.value === undefined || options.value === null;
    svg.setAttribute('viewBox', circular ? '0 0 40 40' : `0 0 ${width} 10`);
    svg.style.transform =
      circular && indeterminate
        ? `rotate(${circularProgressFrame(reduced.matches ? 0 : time).rotation}deg)`
        : '';
    for (const node of [track, buffer, active, second]) node.setAttribute('stroke-width', '4');
    stop.setAttribute('cx', String(width - 2));
    stop.setAttribute('cy', '5');
    stop.style.display = circular || indeterminate ? 'none' : '';
    if (circular) {
      const p = indeterminate
          ? circularProgressFrame(reduced.matches ? 0 : time).progress
          : clamp(fraction),
        gap = 4 / (Math.PI * 36);
      active.setAttribute('d', arc(0, p, options.wavy));
      track.setAttribute('d', arc(Math.min(1, p + gap), Math.max(p + gap, 1 - gap)));
      second.setAttribute('d', '');
      buffer.setAttribute('d', '');
    } else {
      track.setAttribute('d', line(0, 1));
      buffer.setAttribute(
        'd',
        options.buffer === undefined ? '' : line(0, options.buffer / (options.max ?? 1)),
      );
      if (indeterminate) {
        const frames = linearProgressFrame(reduced.matches ? 0.6 : time);
        active.setAttribute('d', line(frames[0]!.start, frames[0]!.end, options.wavy));
        second.setAttribute('d', line(frames[1]!.start, frames[1]!.end, options.wavy));
        const gap = 6 / Math.max(1, width - 4),
          spans = frames
            .filter((frame) => frame.end > frame.start + 0.0001)
            .sort((a, b) => a.start - b.start);
        let cursor = 0,
          path = '';
        for (const span of spans) {
          const start = Math.max(0, span.start - gap),
            end = Math.min(1, span.end + gap);
          if (start > cursor) path += line(cursor, start) + ' ';
          cursor = Math.max(cursor, end);
        }
        if (cursor < 1) path += line(cursor, 1);
        track.setAttribute('d', path);
      } else {
        active.setAttribute('d', line(0, fraction, options.wavy));
        track.setAttribute('d', line(clamp(fraction) + 4 / Math.max(1, width - 4), 1));
        second.setAttribute('d', '');
      }
    }
  }
  function sync() {
    if (scope.disposed) return;
    cancel?.();
    cancel = undefined;
    const max = options.max ?? 1;
    spring.configure(motionPreset(options.motionScheme, 'default.spatial'));
    if (
      !Number.isFinite(max) ||
      max <= 0 ||
      (options.value !== undefined && options.value !== null && !Number.isFinite(options.value))
    )
      throw new RangeError('Finite progress and positive maximum required');
    host.dataset.variant = options.variant ?? 'linear';
    host.dataset.wavy = String(options.wavy ?? false);
    host.setAttribute('aria-label', options.label);
    host.setAttribute('aria-valuemin', '0');
    host.setAttribute('aria-valuemax', String(max));
    const determinate = options.value !== undefined && options.value !== null;
    if (determinate) {
      host.setAttribute('aria-valuenow', String(clamp(options.value! / max) * max));
      spring.setTarget(clamp(options.value! / max));
    } else host.removeAttribute('aria-valuenow');
    draw();
    if (playing && viewport.visible && !reduced.matches && (!determinate || options.wavy))
      cancel = scheduleFrame((dt) => {
        time += dt;
        draw();
        return true;
      });
  }
  const resize = observeSize(host, (w) => {
    width = Math.max(8, w);
    draw();
  });
  scope.add(() => resize.destroy());
  scope.add(() => cancel?.());
  sync();
  return {
    element: host,
    update(next: Partial<ProgressOptions>) {
      options = { ...options, ...next };
      sync();
    },
    pause() {
      playing = false;
      cancel?.();
      cancel = undefined;
      spring.pause();
    },
    play() {
      playing = true;
      spring.play();
      sync();
    },
    replay() {
      time = 0;
      playing = true;
      sync();
    },
    destroy() {
      scope.dispose();
    },
  };
}
