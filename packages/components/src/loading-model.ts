import { solveSpring } from '@epui/motion';
export const loadingMorphInterval = 0.65;
// Official SpringEstimation.estimateUnderDamped envelope, visibilityThreshold=0.1.
export const loadingMorphDuration =
  Math.log(0.1 / Math.sqrt(1 + (0.6 / Math.sqrt(1 - 0.6 * 0.6)) ** 2)) / (-0.6 * Math.sqrt(200));
export function loadingFrame(time: number) {
  if (!Number.isFinite(time) || time < 0) throw new RangeError('Nonnegative loading time required');
  const cycle = Math.floor(time / loadingMorphInterval),
    elapsed = time - cycle * loadingMorphInterval;
  const complete = elapsed >= loadingMorphDuration;
  const progress = complete
    ? 0
    : solveSpring(0, 1, 0, elapsed, { stiffness: 200, dampingRatio: 0.6 }).value;
  return {
    index: (cycle + (complete ? 1 : 0)) % 7,
    progress,
    rotation: ((cycle + (complete ? 2 : 1)) % 4) * 90 + progress * 90,
  };
}
