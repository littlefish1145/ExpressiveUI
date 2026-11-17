import { Scope } from '@epui/core';
import { scheduleFrame, observeReducedMotion } from '@epui/motion';
import { svgElement } from './svg.js';
let rippleId = 0;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
/** Official FastOutSlowIn(0.4,0,0.2,1), used only by legacy ripple radius, not spring motion. */
export function rippleEasing(x: number) {
  x = clamp(x);
  let lo = 0,
    hi = 1,
    t = x;
  for (let i = 0; i < 16; i++) {
    const value = 3 * (1 - t) ** 2 * t * 0.4 + 3 * (1 - t) * t * t * 0.2 + t * t * t;
    if (value < x) lo = t;
    else hi = t;
    t = (lo + hi) / 2;
  }
  return 3 * (1 - t) * t * t + t * t * t;
}
export function rippleFrame(
  seconds: number,
  releasedAt: number | null,
  width: number,
  height: number,
  bounded = true,
  radius?: number,
) {
  const progress = clamp(seconds / 0.225),
    end = radius ?? Math.hypot(width, height) / 2 + (bounded ? 10 : 0),
    start = Math.max(width, height) * 0.3;
  const fadeStart = releasedAt === null ? Infinity : Math.max(0.225, releasedAt);
  const alpha =
    seconds >= fadeStart
      ? 1 - clamp((seconds - fadeStart) / 0.15)
      : releasedAt !== null
        ? 1
        : clamp(seconds / 0.075);
  return {
    radius: start + (end - start) * rippleEasing(progress),
    centerProgress: progress,
    alpha,
    done: seconds >= fadeStart + 0.15,
  };
}
export function bindRipple(
  host: HTMLElement,
  container: HTMLElement,
  { bounded = true, radius }: { bounded?: boolean; radius?: number } = {},
) {
  const scope = new Scope(),
    id = `eui-ripple-${++rippleId}`;
  const svg = svgElement('svg', {
    class: 'eui-ripple',
    'aria-hidden': 'true',
    focusable: 'false',
    preserveAspectRatio: 'none',
  });
  const clip = svgElement('clipPath', { id, clipPathUnits: 'userSpaceOnUse' }),
    clipPath = svgElement('path');
  clip.append(clipPath);
  const defs = svgElement('defs');
  defs.append(clip);
  svg.append(defs);
  const group = svgElement('g');
  if (bounded) group.setAttribute('clip-path', `url(#${id})`);
  svg.append(group);
  container.append(svg);
  const entries = Array.from({ length: 4 }, () => {
    const circle = svgElement('circle', { cx: 0, cy: 0, r: 1, fill: 'currentColor', opacity: 0 });
    group.append(circle);
    return {
      circle,
      active: false,
      time: 0,
      released: null as number | null,
      pointer: null as number | string | null,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
    };
  });
  let cancel: (() => void) | undefined,
    next = 0,
    width = 40,
    height = 40;
  let contour: ArrayLike<number> | undefined;
  function updateClip() {
    if (!contour) {
      clipPath.setAttribute('d', `M0 0H${width}V${height}H0Z`);
      return;
    }
    let path = '';
    for (let i = 0; i < contour.length; i += 2)
      path +=
        (i ? 'L' : 'M') +
        (contour[i]! * width).toFixed(6) +
        ' ' +
        (contour[i + 1]! * height).toFixed(6);
    clipPath.setAttribute('d', path + 'Z');
  }
  function measure() {
    const box = container.getBoundingClientRect();
    width = container.offsetWidth || box.width || 40;
    height = container.offsetHeight || box.height || 40;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    updateClip();
    return box;
  }
  measure();
  const reduced = observeReducedMotion(() => {
    if (reduced.matches) {
      cancel?.();
      cancel = undefined;
      for (const e of entries) {
        e.active = false;
        e.circle.setAttribute('opacity', '0');
      }
    }
  });
  function draw(e: (typeof entries)[number]) {
    const state = rippleFrame(e.time, e.released, e.width, e.height, bounded, radius);
    const cx = e.x + (e.width / 2 - e.x) * state.centerProgress,
      cy = e.y + (e.height / 2 - e.y) * state.centerProgress;
    e.circle.setAttribute('transform', `translate(${cx} ${cy}) scale(${state.radius})`);
    e.circle.setAttribute('opacity', String(state.alpha * 0.1));
    if (state.done) e.active = false;
  }
  function start(pointer: number | string, event?: PointerEvent) {
    if (scope.disposed || host.matches(':disabled')) return;
    const box = measure(),
      entry = entries[next++ % entries.length]!;
    Object.assign(entry, {
      active: true,
      time: 0,
      released: null,
      pointer,
      width,
      height,
      x: bounded && event ? event.clientX - box.left : width / 2,
      y: bounded && event ? event.clientY - box.top : height / 2,
    });
    if (reduced.matches) {
      entry.circle.setAttribute(
        'transform',
        `translate(${width / 2} ${height / 2}) scale(${radius ?? Math.hypot(width, height) / 2})`,
      );
      entry.circle.setAttribute('opacity', '.1');
      return;
    }
    draw(entry);
    if (!cancel)
      cancel = scheduleFrame((dt) => {
        let active = false;
        for (const e of entries)
          if (e.active) {
            e.time += dt;
            draw(e);
            active ||= e.active;
          }
        if (!active) cancel = undefined;
        return active;
      });
  }
  function release(pointer?: number | string) {
    for (const e of entries)
      if (e.active && (pointer === undefined || e.pointer === pointer)) {
        if (reduced.matches) {
          e.active = false;
          e.circle.setAttribute('opacity', '0');
        } else if (e.released === null) e.released = e.time;
      }
  }
  scope.listen(host, 'pointerdown', (event) => {
    const e = event as PointerEvent;
    if (e.button === 0) start(e.pointerId, e);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
    scope.listen(host, type, (event) => release((event as PointerEvent).pointerId));
  scope.listen(host, 'keydown', (event) => {
    const e = event as KeyboardEvent;
    if (!e.repeat && (e.key === ' ' || e.key === 'Enter')) start('key');
  });
  scope.listen(host, 'keyup', (event) => {
    if ([' ', 'Enter'].includes((event as KeyboardEvent).key)) release('key');
  });
  scope.listen(host, 'blur', () => release());
  scope.listen(host, 'click', (event) => {
    if (
      (event as MouseEvent).detail === 0 &&
      !entries.some((e) => e.active && e.pointer === 'key')
    ) {
      start('click');
      release('click');
    }
  });
  const disabledObserver = new MutationObserver(() => {
    if (host.matches(':disabled')) {
      cancel?.();
      cancel = undefined;
      for (const e of entries) {
        e.active = false;
        e.circle.setAttribute('opacity', '0');
      }
    }
  });
  disabledObserver.observe(host, { attributes: true, attributeFilter: ['disabled'] });
  let ancestor = host.parentElement;
  while (ancestor) {
    if (ancestor.tagName === 'FIELDSET')
      disabledObserver.observe(ancestor, { attributes: true, attributeFilter: ['disabled'] });
    ancestor = ancestor.parentElement;
  }
  scope.add(() => disabledObserver.disconnect());
  scope.add(() => {
    cancel?.();
    reduced.destroy();
    svg.remove();
  });
  return {
    setContour(points: ArrayLike<number>) {
      if (!bounded) return;
      contour = points;
      updateClip();
    },
    refresh: measure,
    destroy() {
      scope.dispose();
    },
  };
}
