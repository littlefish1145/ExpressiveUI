import { observeReducedMotion } from './preference.js';
import { motionTokens } from '@expressive-ui/tokens';
import type { MotionScheme, MotionToken } from '@expressive-ui/tokens';
import { solveSpring, springAtRest, sampleSpring, validateSpring } from './spring.js';
import type { SpringParameters } from './spring.js';
import { scheduleFrame } from './scheduler.js';
export * from './spring.js';
export * from './preference.js';
export { activeAnimationCount, scheduleFrame } from './scheduler.js';
export type { MotionScheme, MotionToken } from '@expressive-ui/tokens';
export function motionPreset(
  scheme: MotionScheme = 'expressive',
  token: MotionToken = 'default.spatial',
): SpringParameters {
  return { ...motionTokens[scheme][token] };
}
export interface SpringOptions extends Partial<SpringParameters> {
  reducedMotion?: boolean;
}
export function createSpring(
  initial: number,
  render: (value: number, velocity: number) => void,
  options: SpringOptions = {},
) {
  if (!Number.isFinite(initial)) throw new TypeError('Finite initial value required');
  let parameters: SpringParameters = { ...motionPreset(), ...options };
  validateSpring(parameters);
  let value = initial,
    velocity = options.initialVelocity ?? 0,
    target = initial,
    previousTarget = initial;
  let paused = false,
    disposed = false,
    cancel: (() => void) | undefined;
  const reduced = observeReducedMotion(() => {
    if (isReduced()) jump(target);
  });
  const isReduced = () => options.reducedMotion ?? reduced.matches;
  function stop() {
    cancel?.();
    cancel = undefined;
  }
  function jump(next: number) {
    stop();
    target = next;
    value = next;
    velocity = 0;
    render(value, velocity);
  }
  function start() {
    if (disposed || paused || cancel) return;
    if (isReduced()) {
      jump(target);
      return;
    }
    cancel = scheduleFrame((dt) => {
      if (disposed || paused) {
        cancel = undefined;
        return false;
      }
      const state = solveSpring(value, target, velocity, dt, parameters);
      value = state.value;
      velocity = state.velocity;
      if (springAtRest(state, target, parameters)) {
        value = target;
        velocity = 0;
        render(value, velocity);
        cancel = undefined;
        return false;
      }
      render(value, velocity);
      return true;
    });
  }
  return {
    get value() {
      return value;
    },
    get velocity() {
      return velocity;
    },
    get target() {
      return target;
    },
    get running() {
      return !!cancel;
    },
    setTarget(next: number, kick?: { initialVelocity: number }) {
      if (disposed) return;
      if (!Number.isFinite(next)) throw new TypeError('Finite target required');
      if (kick) {
        if (!Number.isFinite(kick.initialVelocity))
          throw new TypeError('Finite initial velocity required');
        velocity = kick.initialVelocity;
      }
      previousTarget = target;
      target = next;
      if (value === target && velocity === 0) return;
      start();
    },
    configure(next: Partial<SpringParameters>) {
      const candidate = { ...parameters, ...next };
      validateSpring(candidate);
      parameters = candidate;
    },
    reverse() {
      const next = previousTarget;
      previousTarget = target;
      target = next;
      start();
    },
    jump(next: number) {
      if (disposed) return;
      if (!Number.isFinite(next)) throw new TypeError('Finite target required');
      jump(next);
    },
    pause() {
      paused = true;
      stop();
    },
    play() {
      if (disposed) return;
      paused = false;
      if (value !== target || velocity !== 0) start();
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      stop();
      reduced.destroy();
    },
  };
}
export type SpringController = ReturnType<typeof createSpring>;
export interface AnimateSpringOptions extends SpringParameters {
  from: number;
  to: number;
  reducedMotion?: boolean;
}
/** Fixed-target sampled WAAPI. Uses the exact same physics as createSpring. */
export function animateSpring(
  element: HTMLElement,
  project: (value: number) => Keyframe,
  options: AnimateSpringOptions,
) {
  validateSpring(options);
  if (![options.from, options.to].every(Number.isFinite))
    throw new RangeError('Finite endpoints required');
  let animation: Animation | undefined,
    fallback: SpringController | undefined,
    done = false;
  let resolveFinished: (completed: boolean) => void = () => {};
  const finished = new Promise<boolean>((resolve) => {
    resolveFinished = resolve;
  });
  const write = (value: number) => {
    const style = project(value);
    for (const [key, v] of Object.entries(style))
      if (!['offset', 'easing', 'composite'].includes(key) && v !== null && v !== undefined) {
        const cssName = key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
        element.style.setProperty(cssName, String(v));
      }
  };
  const reduced = observeReducedMotion((matches) => {
    if (matches && options.reducedMotion !== false) complete();
  });
  function complete() {
    if (done) return;
    done = true;
    write(options.to);
    animation?.cancel();
    fallback?.destroy();
    reduced.destroy();
    resolveFinished(true);
  }
  if (options.reducedMotion ?? reduced.matches) complete();
  else if (typeof element.animate === 'function') {
    try {
      const { samples, duration } = sampleSpring(options.from, options.to, options);
      animation = element.animate(
        samples.map((s) => ({ ...project(s.value), offset: s.offset, easing: 'linear' })),
        { duration: duration * 1000, easing: 'linear', fill: 'both' },
      );
    } catch (error) {
      reduced.destroy();
      throw error;
    }
    void animation.finished.then(complete, () => {
      if (!done) {
        done = true;
        reduced.destroy();
        resolveFinished(false);
      }
    });
  } else {
    fallback = createSpring(
      options.from,
      (value) => {
        write(value);
        if (Math.abs(value - options.to) < 1e-12) complete();
      },
      options,
    );
    fallback.setTarget(options.to);
  }
  return {
    finished,
    pause() {
      animation?.pause();
      fallback?.pause();
    },
    play() {
      if (!done) {
        animation?.play();
        fallback?.play();
      }
    },
    get value() {
      if (done) return options.to;
      if (fallback) return fallback.value;
      return solveSpring(
        options.from,
        options.to,
        options.initialVelocity ?? 0,
        Number(animation?.currentTime ?? 0) / 1000,
        options,
      ).value;
    },
    get velocity() {
      if (done) return 0;
      if (fallback) return fallback.velocity;
      return solveSpring(
        options.from,
        options.to,
        options.initialVelocity ?? 0,
        Number(animation?.currentTime ?? 0) / 1000,
        options,
      ).velocity;
    },
    cancel() {
      if (done) return;
      done = true;
      animation?.cancel();
      fallback?.destroy();
      reduced.destroy();
      resolveFinished(false);
    },
    destroy() {
      this.cancel();
    },
  };
}
