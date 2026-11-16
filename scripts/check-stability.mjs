import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
import { generateTheme, themePresets } from '@amiracle1024/theme';
import {
  createMorph,
  getShape,
  alignContourTarget,
  signedArea,
  sampleCubics,
  emptyExperimentMetrics,
  recordContour,
  cubicPathDiscontinuity,
  cubicBoundaryDeviation,
  sampleDistribution,
} from '@amiracle1024/shape';
import { solveSpring, motionPreset, createVectorState } from '@amiracle1024/motion';
const parameters = motionPreset('expressive', 'fast.spatial');
const runs = [];
const metrics = emptyExperimentMetrics(),
  geometryTimes = sampleDistribution(4096);
// Independent known-distance check for the boundary metric.
const straight = new Float64Array([0, 0, 1 / 3, 0, 2 / 3, 0, 1, 0]);
const shifted = straight.map((value, i) => value + (i % 2 ? 0.2 : 0.1));
assert.equal(cubicPathDiscontinuity(straight), 1);
assert(Math.abs(cubicBoundaryDeviation(straight, shifted) - Math.hypot(0.1, 0.2)) < 1e-12);
assert.equal(
  cubicPathDiscontinuity(new Float64Array([0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0])),
  0,
);
const ranks = sampleDistribution(4);
[1, 2, 3, 4, 5].forEach((value) => ranks.add(value));
assert.deepEqual(ranks.summary(), { p50: 3, p95: 5, p99: 5, max: 5, count: 5, retained: 4 });
const retainedMax = sampleDistribution(4);
[100, 1, 2, 3, 4].forEach((value) => retainedMax.add(value));
assert.equal(retainedMax.summary().max, 100);
assert.equal(retainedMax.summary().p99, 4);
assert.deepEqual(sampleDistribution().summary(), {
  p50: null,
  p95: null,
  p99: null,
  max: null,
  count: 0,
  retained: 0,
});
function intersections(points) {
  const n = points.length / 2;
  let count = 0;
  const side = (a, b, c) =>
    (points[b * 2] - points[a * 2]) * (points[c * 2 + 1] - points[a * 2 + 1]) -
    (points[b * 2 + 1] - points[a * 2 + 1]) * (points[c * 2] - points[a * 2]);
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
for (const shape of ['cookie9Sided', 'flower']) {
  const pair = createMorph('circle', shape, { count: 128 });
  await pair.ready;
  const source = pair.cubicsAt(0).slice(),
    destination = pair.cubicsAt(1).slice(),
    reference = new Float64Array(source.length);
  let value = 0,
    velocity = 0,
    minArea = Infinity,
    maxBoundaryJump = 0,
    crossings = 0;
  for (let i = 0; i < 100; i++) {
    const before = pair.at(value).slice();
    const target = i % 2 === 0 ? 1 : 0;
    const atBoundary = pair.at(value);
    maxBoundaryJump = Math.max(
      maxBoundaryJump,
      ...before.map((v, index) => Math.abs(v - atBoundary[index])),
    );
    for (let frame = 0; frame < 3; frame++) {
      const next = solveSpring(value, target, velocity, 1 / 120, parameters);
      value = next.value;
      velocity = next.velocity;
      const started = performance.now();
      const cubics = pair.cubicsAt(value);
      const points = sampleCubics(cubics, 128);
      geometryTimes.add(performance.now() - started);
      recordContour(metrics.geometry, points);
      for (let coordinate = 0; coordinate < reference.length; coordinate++)
        reference[coordinate] =
          source[coordinate] + (destination[coordinate] - source[coordinate]) * value;
      metrics.geometry.maxPathDiscontinuity = Math.max(
        metrics.geometry.maxPathDiscontinuity ?? 0,
        cubicPathDiscontinuity(cubics),
      );
      metrics.geometry.maxBoundaryDeviation = Math.max(
        metrics.geometry.maxBoundaryDeviation ?? 0,
        cubicBoundaryDeviation(cubics, reference),
      );
      assert(points.every(Number.isFinite));
      minArea = Math.min(minArea, signedArea(points));
      crossings += intersections(points);
    }
  }
  assert.equal(maxBoundaryJump, 0);
  assert(minArea > 0);
  assert.equal(crossings, 0);
  runs.push({
    pair: 'circle|' + shape,
    reversals: 100,
    frames: 300,
    nonfinite: 0,
    selfIntersections: crossings,
    minArea,
    maxBoundaryJump,
  });
}
const sampleTimes = [0.0166666666667, 0.05, 0.1, 0.2, 0.3, 0.5, 0.8, 1.2];
const rates = [];
for (const hz of [60, 90, 120, 144]) {
  let maxError = 0;
  for (const time of sampleTimes) {
    const vector = createVectorState([0], parameters);
    vector.retarget([1]);
    let elapsed = 0;
    while (elapsed < time - 1e-12) {
      const dt = Math.min(1 / hz, time - elapsed);
      vector.step(dt);
      elapsed += dt;
    }
    const expected = solveSpring(0, 1, 0, time, parameters);
    maxError = Math.max(
      maxError,
      Math.abs(vector.positions[0] - expected.value),
      Math.abs(vector.velocities[0] - expected.velocity),
    );
  }
  assert(maxError < 1e-10);
  rates.push({ hz, maxError });
}
const initial = getShape('circle', 100, 100, 128),
  vector = createVectorState(initial, parameters);
vector.retarget(alignContourTarget(vector.positions, getShape('cookie9Sided', 100, 100, 128)));
let t = 0;
while (solveSpring(0, 1, 0, t, parameters).value < 0.3) {
  vector.step(1 / 1000);
  t += 1 / 1000;
}
const oldPosition = vector.positions.slice(),
  oldVelocity = vector.velocities.slice();
vector.retarget(alignContourTarget(vector.positions, getShape('flower', 240, 140, 128)));
const positionJump = Math.max(...oldPosition.map((v, i) => Math.abs(v - vector.positions[i]))),
  velocityJump = Math.max(...oldVelocity.map((v, i) => Math.abs(v - vector.velocities[i])));
assert.equal(positionJump, 0);
assert.equal(velocityJump, 0);
let settlingTimeMs = null;
for (let i = 0; i < 1000; i++) {
  const resting = vector.step(1 / 120);
  if (resting && settlingTimeMs === null) settlingTimeMs = ((i + 1) / 120) * 1000;
  recordContour(metrics.geometry, vector.positions);
}
assert(settlingTimeMs !== null);
assert(vector.positions.every(Number.isFinite));
assert(signedArea(vector.positions) > 0);
assert.equal(intersections(vector.positions), 0);
// Static DOM name coverage. This deliberately does not simulate layout or claim an axe/Lighthouse result.
const window = new Window();
window.document.write(await readFile('dist/playground/index.html', 'utf8'));
const unnamed = [...window.document.querySelectorAll('input,textarea,select')]
  .filter(
    (element) =>
      !['hidden', 'submit', 'button', 'reset'].includes(element.type) &&
      !element.getAttribute('aria-label') &&
      !element.getAttribute('aria-labelledby') &&
      !element.labels?.length,
  )
  .map((element) => element.id || element.outerHTML);
assert.deepEqual(unnamed, []);
const genericNamed = [...window.document.querySelectorAll('span[aria-label],div[aria-label]')]
  .filter((element) => !element.hasAttribute('role'))
  .map((element) => element.id || element.outerHTML);
assert.deepEqual(genericNamed, []);
const report = {
  ...metrics,
  environment: 'Node.js deterministic numeric + static HTML; no real browser',
  runs,
  rates,
  redirect: {
    at: t,
    positionJump,
    velocityJump,
    resize: 'normalized coordinates; no window simulated',
  },
  staticAccessibility: { unnamedControls: unnamed, prohibitedGenericNames: genericNamed },
  browserResults: null,
  longRunResults: null,
};
Object.assign(metrics.motion, {
  maxPositionJump: positionJump,
  maxVelocityJump: velocityJump,
  maxSolverError: Math.max(...rates.map((row) => row.maxError)),
  finalTarget: [...vector.target],
  settlingTimeMs,
});
assert(
  metrics.geometry.maxPathDiscontinuity < 1e-5,
  'Cubic seam exceeds normalized rounding tolerance',
);
assert(metrics.geometry.maxBoundaryDeviation < 1e-10, 'Boundary differs from matched reference');
assert(settlingTimeMs > 0 && settlingTimeMs < 5000, 'Unexpected model settling time');
metrics.performance.geometryComputeP95 = geometryTimes.summary().p95;
report.measurementNotes = {
  geometryUnits: 'normalized; minSignedArea in squared units',
  maxPathDiscontinuity: 'maximum C0 cubic join gap including closure',
  maxBoundaryDeviation:
    'maximum paired-parameter sampled distance to direct endpoint-cubic interpolation; not browser pixels/Hausdorff',
  settlingTimeMs: 'model time after final redirect, energy/velocity thresholds',
  finalTarget: 'aligned normalized destination contour',
  performance:
    'frame cadence/droppedFrames null: Node has no measured browser frames; geometryComputeP95 uses Node performance.now and excludes diagnostics',
  geometrySamples: geometryTimes.count,
};
function luminance(hex) {
  const rgb = hex
    .slice(1)
    .match(/../g)
    .map((s) => parseInt(s, 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
const contrastRows = [];
for (const preset of themePresets)
  for (const dark of [false, true]) {
    const colors = generateTheme({ ...preset, dark }).colors;
    for (const [background, foreground] of [
      ['primary', 'onPrimary'],
      ['secondaryContainer', 'onSecondaryContainer'],
      ['surfaceContainerLow', 'onSurfaceVariant'],
      ['surfaceContainer', 'onSurface'],
      ['inverseSurface', 'inverseOnSurface'],
    ]) {
      const a = luminance(colors[background]),
        b = luminance(colors[foreground]),
        ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      contrastRows.push({ preset: preset.id, dark, background, foreground, ratio });
      assert(ratio >= 4.5, `${preset.id} ${dark} ${foreground} ${ratio}`);
    }
  }
report.tokenContrast = {
  scope:
    '8 presets × light/dark × 5 text roles, contrast=0. Not rendered CSS contrast or Lighthouse.',
  pairs: contrastRows.length,
  minimum: Math.min(...contrastRows.map((row) => row.ratio)),
  rows: contrastRows,
};
await writeFile('docs/stability-results.json', JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      ...report,
      motion: {
        ...report.motion,
        finalTarget: `flower (${vector.target.length / 2} points; full coordinates in JSON file)`,
      },
      tokenContrast: { pairs: report.tokenContrast.pairs, minimum: report.tokenContrast.minimum },
    },
    null,
    2,
  ),
);
window.happyDOM.abort();
