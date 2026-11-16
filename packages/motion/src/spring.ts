export interface SpringParameters {
  /** Mass = 1; stiffness in s^-2. */
  stiffness: number;
  dampingRatio: number;
  /** value units per second, never pixels per frame. */
  initialVelocity?: number;
  positionThreshold?: number;
  velocityThreshold?: number;
}
export interface SpringState {
  value: number;
  velocity: number;
}
export function validateSpring(parameters: SpringParameters): void {
  if (!Number.isFinite(parameters.stiffness) || parameters.stiffness <= 0)
    throw new RangeError('stiffness must be finite and > 0');
  if (!Number.isFinite(parameters.dampingRatio) || parameters.dampingRatio < 0)
    throw new RangeError('dampingRatio must be finite and >= 0');
  if (parameters.initialVelocity !== undefined && !Number.isFinite(parameters.initialVelocity))
    throw new RangeError('Invalid initialVelocity');
  for (const threshold of [parameters.positionThreshold, parameters.velocityThreshold])
    if (threshold !== undefined && (!Number.isFinite(threshold) || threshold <= 0))
      throw new RangeError('Thresholds must be finite and > 0');
}
/** Closed-form solution of x'' + 2*zeta*sqrt(k)*x' + k*(x-target) = 0. */
export function solveSpring(
  from: number,
  target: number,
  velocity: number,
  seconds: number,
  parameters: SpringParameters,
): SpringState {
  validateSpring(parameters);
  if (![from, target, velocity, seconds].every(Number.isFinite) || seconds < 0)
    throw new RangeError('Finite values and nonnegative time required');
  if (seconds === 0) return { value: from, velocity };
  const w = Math.sqrt(parameters.stiffness),
    z = parameters.dampingRatio,
    x = from - target;
  let displacement: number, v: number;
  if (z < 1 - 1e-7) {
    const a = z * w,
      b = w * Math.sqrt(1 - z * z),
      c = (velocity + a * x) / b;
    const s = Math.sin(b * seconds),
      cos = Math.cos(b * seconds),
      e = Math.exp(-a * seconds);
    displacement = e * (x * cos + c * s);
    v = e * ((-a * x + b * c) * cos + (-a * c - b * x) * s);
  } else if (z <= 1 + 1e-7) {
    const c = velocity + w * x,
      e = Math.exp(-w * seconds);
    displacement = e * (x + c * seconds);
    v = e * (c - w * (x + c * seconds));
  } else {
    // Stable roots avoid subtracting two close large numbers at high damping.
    const root = Math.sqrt(z * z - 1),
      r1 = -w / (z + root),
      r2 = -w * (z + root);
    const c1 = (velocity - r2 * x) / (r1 - r2),
      c2 = x - c1;
    const e1 = Math.exp(r1 * seconds),
      e2 = Math.exp(r2 * seconds);
    displacement = c1 * e1 + c2 * e2;
    v = r1 * c1 * e1 + r2 * c2 * e2;
  }
  return { value: target + displacement, velocity: v };
}
export function springAtRest(
  state: SpringState,
  target: number,
  parameters: SpringParameters,
): boolean {
  // Energy-derived amplitude bound prevents stopping at an early zero crossing.
  const amplitude = Math.hypot(
    state.value - target,
    state.velocity / Math.sqrt(parameters.stiffness),
  );
  return (
    amplitude <= (parameters.positionThreshold ?? 0.001) &&
    Math.abs(state.velocity) <= (parameters.velocityThreshold ?? 0.01)
  );
}
export interface SpringSample extends SpringState {
  time: number;
  offset: number;
}
export function sampleSpring(
  from: number,
  to: number,
  parameters: SpringParameters,
  options: { fps?: number; maxDuration?: number } = {},
) {
  validateSpring(parameters);
  const fps = options.fps ?? 120,
    maxDuration = options.maxDuration ?? 20;
  if (
    !Number.isFinite(fps) ||
    fps < 1 ||
    fps > 1000 ||
    !Number.isFinite(maxDuration) ||
    maxDuration <= 0 ||
    maxDuration > 60
  )
    throw new RangeError('Invalid sampling limits');
  const samples: SpringSample[] = [];
  const velocity = parameters.initialVelocity ?? 0;
  let settled = false;
  for (let frame = 0; frame <= Math.ceil(maxDuration * fps); frame++) {
    const time = frame / fps,
      state = solveSpring(from, to, velocity, time, parameters);
    samples.push({ ...state, time, offset: 0 });
    if (frame > 0 && springAtRest(state, to, parameters)) {
      settled = true;
      break;
    }
  }
  if (!settled)
    throw new RangeError(
      'Spring did not settle within sampling limit; use the interactive runtime for undamped motion',
    );
  const duration = samples.at(-1)!.time;
  for (const sample of samples) sample.offset = sample.time / duration;
  samples.at(-1)!.value = to;
  samples.at(-1)!.velocity = 0;
  return { samples, duration };
}
