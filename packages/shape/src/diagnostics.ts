import { signedArea } from './geometry.js';

export interface ExperimentMetrics {
  geometry: {
    nonfiniteCount: number | null;
    selfIntersectionCount: number | null;
    maxPathDiscontinuity: number | null;
    maxBoundaryDeviation: number | null;
    minSignedArea: number | null;
  };
  motion: {
    maxPositionJump: number | null;
    maxVelocityJump: number | null;
    maxSolverError: number | null;
    finalTarget: number | number[] | null;
    settlingTimeMs: number | null;
  };
  performance: {
    frameTimeP50: number | null;
    frameTimeP95: number | null;
    frameTimeP99: number | null;
    maxFrameTime: number | null;
    droppedFrames: number | null;
    geometryComputeP95: number | null;
  };
}
/** null means no applicable observation, never a synthetic zero. */
export function emptyExperimentMetrics(): ExperimentMetrics {
  return {
    geometry: {
      nonfiniteCount: null,
      selfIntersectionCount: null,
      maxPathDiscontinuity: null,
      maxBoundaryDeviation: null,
      minSignedArea: null,
    },
    motion: {
      maxPositionJump: null,
      maxVelocityJump: null,
      maxSolverError: null,
      finalTarget: null,
      settlingTimeMs: null,
    },
    performance: {
      frameTimeP50: null,
      frameTimeP95: null,
      frameTimeP99: null,
      maxFrameTime: null,
      droppedFrames: null,
      geometryComputeP95: null,
    },
  };
}
/** Strict nonadjacent crossings; touching/collinear edges are not counted. */
export function contourIntersections(points: ArrayLike<number>) {
  const n = points.length / 2;
  let count = 0;
  const side = (a: number, b: number, c: number) =>
    (points[b * 2]! - points[a * 2]!) * (points[c * 2 + 1]! - points[a * 2 + 1]!) -
    (points[b * 2 + 1]! - points[a * 2 + 1]!) * (points[c * 2]! - points[a * 2]!);
  for (let a = 0; a < n; a++)
    for (let b = a + 2; b < n; b++) {
      const an = (a + 1) % n,
        bn = (b + 1) % n;
      if (a === bn) continue;
      if (side(a, an, b) * side(a, an, bn) < -1e-14 && side(b, bn, a) * side(b, bn, an) < -1e-14)
        count++;
    }
  return count;
}
/** C0 seam distance, including the last cubic's endpoint to the first start. */
export function cubicPathDiscontinuity(cubics: ArrayLike<number>): number {
  if (!cubics.length || cubics.length % 8) throw new RangeError('Matched cubic path required');
  let max = 0;
  for (let i = 0; i < cubics.length; i += 8) {
    const next = (i + 8) % cubics.length;
    max = Math.max(
      max,
      Math.hypot(cubics[i + 6]! - cubics[next]!, cubics[i + 7]! - cubics[next + 1]!),
    );
  }
  return max;
}
/** Maximum paired-parameter boundary distance, sampled within matching cubic segments. Not a pixel/Hausdorff audit. */
export function cubicBoundaryDeviation(
  actual: ArrayLike<number>,
  reference: ArrayLike<number>,
  subdivisions = 8,
): number {
  if (
    !actual.length ||
    actual.length !== reference.length ||
    actual.length % 8 ||
    !Number.isInteger(subdivisions) ||
    subdivisions < 1
  )
    throw new RangeError('Matching cubics and positive subdivisions required');
  let max = 0;
  for (let i = 0; i < actual.length; i += 8)
    for (let j = 0; j <= subdivisions; j++) {
      const t = j / subdivisions,
        u = 1 - t;
      let dx = 0,
        dy = 0;
      for (let k = 0; k < 4; k++) {
        const weight =
          k === 0 ? u * u * u : k === 1 ? 3 * u * u * t : k === 2 ? 3 * u * t * t : t * t * t;
        dx += weight * (actual[i + k * 2]! - reference[i + k * 2]!);
        dy += weight * (actual[i + k * 2 + 1]! - reference[i + k * 2 + 1]!);
      }
      max = Math.max(max, Math.hypot(dx, dy));
    }
  return max;
}
export function recordContour(metrics: ExperimentMetrics['geometry'], points: ArrayLike<number>) {
  let invalid = 0;
  for (let i = 0; i < points.length; i++) if (!Number.isFinite(points[i])) invalid++;
  metrics.nonfiniteCount = (metrics.nonfiniteCount ?? 0) + invalid;
  if (invalid) return;
  metrics.selfIntersectionCount =
    (metrics.selfIntersectionCount ?? 0) + contourIntersections(points);
  metrics.minSignedArea = Math.min(metrics.minSignedArea ?? Infinity, signedArea(points));
}
/** Bounded ring for diagnostics, nearest-rank quantiles; whole-run max/count remain exact. */
export function sampleDistribution(capacity = 36000) {
  if (!Number.isInteger(capacity) || capacity < 1)
    throw new RangeError('Positive sample capacity required');
  const values = new Float64Array(capacity);
  let count = 0,
    max: number | null = null;
  return {
    add(value: number) {
      if (!Number.isFinite(value) || value < 0) return;
      values[count % capacity] = value;
      count++;
      max = Math.max(max ?? 0, value);
    },
    get count() {
      return count;
    },
    summary() {
      const sorted = values.slice(0, Math.min(count, capacity)).sort();
      const q = (p: number) => (sorted.length ? sorted[Math.ceil(p * sorted.length) - 1]! : null);
      return { p50: q(0.5), p95: q(0.95), p99: q(0.99), max, count, retained: sorted.length };
    },
  };
}
