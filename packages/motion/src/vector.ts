import { solveSpring, validateSpring } from './spring.js';
import type { SpringParameters } from './spring.js';
import { scheduleFrame } from './scheduler.js';
import { observeReducedMotion } from './preference.js';

/** Shared analytic model for fixed-size vectors, in value units and seconds. */
export function createVectorState(initial: ArrayLike<number>, initialParameters: SpringParameters) {
  const positions = Float64Array.from(initial),
    velocities = new Float64Array(initial.length),
    target = positions.slice();
  let parameters = { ...initialParameters };
  validateSpring(parameters);
  function validate(values: ArrayLike<number>) {
    if (!values.length || values.length !== positions.length)
      throw new RangeError('Vector dimensions must match');
    for (let i = 0; i < values.length; i++)
      if (!Number.isFinite(values[i])) throw new TypeError('Finite vector required');
  }
  validate(initial);
  return {
    positions,
    velocities,
    target,
    retarget(next: ArrayLike<number>) {
      validate(next);
      target.set(next);
    },
    configure(next: SpringParameters) {
      validateSpring(next);
      parameters = { ...next };
    },
    jump(next: ArrayLike<number>) {
      validate(next);
      positions.set(next);
      target.set(next);
      velocities.fill(0);
    },
    step(seconds: number) {
      if (!Number.isFinite(seconds) || seconds < 0)
        throw new RangeError('Nonnegative finite timestep required');
      // One transition matrix per frame, rather than one solver allocation per coordinate.
      const x = solveSpring(1, 0, 0, seconds, parameters),
        v = solveSpring(0, 0, 1, seconds, parameters);
      const inverseFrequency = 1 / Math.sqrt(parameters.stiffness);
      let resting = true;
      for (let i = 0; i < positions.length; i++) {
        const delta = positions[i]! - target[i]!,
          velocity = velocities[i]!;
        positions[i] = target[i]! + x.value * delta + v.value * velocity;
        velocities[i] = x.velocity * delta + v.velocity * velocity;
        if (
          Math.hypot(positions[i]! - target[i]!, velocities[i]! * inverseFrequency) >
            (parameters.positionThreshold ?? 0.001) ||
          Math.abs(velocities[i]!) > (parameters.velocityThreshold ?? 0.01)
        )
          resting = false;
      }
      return resting;
    },
  };
}
export function createVectorSpring(
  initial: ArrayLike<number>,
  render: (value: Float64Array, velocity: Float64Array) => void,
  parameters: SpringParameters,
) {
  const state = createVectorState(initial, parameters);
  let cancel: (() => void) | undefined,
    paused = false,
    disposed = false;
  const halt = () => {
    cancel?.();
    cancel = undefined;
  };
  const reduced = observeReducedMotion(() => {
    if (reduced.matches) jump(state.target);
  });
  function jump(next: ArrayLike<number>) {
    halt();
    state.jump(next);
    render(state.positions, state.velocities);
  }
  function start() {
    if (disposed || paused || cancel) return;
    if (reduced.matches) {
      jump(state.target);
      return;
    }
    cancel = scheduleFrame((dt) => {
      const resting = state.step(dt);
      if (resting) state.jump(state.target);
      render(state.positions, state.velocities);
      if (resting) cancel = undefined;
      return !resting;
    });
  }
  return {
    get value() {
      return state.positions;
    },
    get velocity() {
      return state.velocities;
    },
    setTarget(next: ArrayLike<number>) {
      if (disposed) return;
      state.retarget(next);
      start();
    },
    jump(next: ArrayLike<number>) {
      if (!disposed) jump(next);
    },
    configure(next: SpringParameters) {
      if (!disposed) state.configure(next);
    },
    pause() {
      paused = true;
      halt();
    },
    play() {
      if (!disposed) {
        paused = false;
        start();
      }
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      halt();
      reduced.destroy();
    },
  };
}
