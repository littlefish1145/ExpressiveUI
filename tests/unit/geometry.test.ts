import { describe, it, expect } from 'vitest';
import {
  getShape,
  shapeNames,
  createMorph,
  normalizeContour,
  resampleContour,
  signedArea,
  alignContours,
  interpolateContour,
  roundedRectangle,
  clearShapeCache,
  shapeCacheStats,
  flattenCubics,
} from '@expressive-ui/shape';
describe('official shape library', () => {
  it('contains all 35 exported official polygons, finite, closed and normalized', () => {
    expect(shapeNames).toHaveLength(35);
    for (const name of shapeNames) {
      const points = getShape(name, 100, 100, 256);
      expect(points.length).toBe(512);
      expect([...points].every(Number.isFinite)).toBe(true);
      expect(signedArea(points)).toBeGreaterThan(0);
      expect(Math.min(...points)).toBeGreaterThan(-0.001);
      expect(Math.max(...points)).toBeLessThan(1.001);
    }
  });
  it('can morph every pair, preserving numeric endpoints', async () => {
    for (const from of shapeNames)
      for (const to of shapeNames) {
        const morph = createMorph(from, to, { count: 32 });
        await morph.ready;
        const start = morph.at(0).slice(),
          end = morph.at(1).slice(),
          middle = morph.at(0.5);
        expect([...middle].every(Number.isFinite)).toBe(true);
        for (let i = 0; i < middle.length; i++)
          expect(middle[i]).toBeCloseTo((start[i]! + end[i]!) / 2, 10);
      }
  }, 30000);
  it('does not let a caller corrupt cached geometry', () => {
    const a = getShape('heart');
    a.fill(999);
    expect(getShape('heart')[0]).not.toBe(999);
  });
  it('bounds both geometry caches', () => {
    clearShapeCache();
    for (let i = 0; i < 100; i++) {
      getShape('rounded:small', 100 + i, 40);
      createMorph('circle', 'heart', { width: 100 + i, count: 16 });
    }
    const stats = shapeCacheStats();
    expect(stats.shapes).toBeLessThanOrEqual(stats.limit);
    expect(stats.morphs).toBeLessThanOrEqual(stats.limit);
  });
});
describe('contour correspondence', () => {
  const square = [0, 0, 1, 0, 1, 1, 0, 1];
  it('removes closing and repeated points', () => {
    expect([...normalizeContour([...square, 0, 1, 0, 0])]).toEqual(square);
  });
  it('normalizes reversed winding', () => {
    expect(signedArea(normalizeContour([0, 0, 0, 1, 1, 1, 1, 0]))).toBeGreaterThan(0);
  });
  it('aligns a rotated start and reversed direction without twisting', () => {
    const p = alignContours(square, [1, 1, 1, 0, 0, 0, 0, 1], 32);
    for (let i = 0; i < p.from.length; i++) expect(p.from[i]).toBeCloseTo(p.to[i]!, 10);
  });
  it('resamples arc lengths evenly including the closing segment', () => {
    const points = resampleContour(square, 16);
    for (let i = 0; i < 16; i++) {
      const j = (i + 1) % 16;
      expect(
        Math.hypot(points[i * 2]! - points[j * 2]!, points[i * 2 + 1]! - points[j * 2 + 1]!),
      ).toBeCloseTo(0.25, 8);
    }
  });
  it('supports overshoot and reuses a supplied output buffer', () => {
    const out = new Float64Array(8);
    expect(
      interpolateContour(
        square,
        square.map((x) => x + 1),
        1.1,
        out,
      ),
    ).toBe(out);
    expect(out[0]).toBeCloseTo(1.1);
  });
  it('keeps pixel corner radii circular on non-square components', () => {
    const p = roundedRectangle(240, 40, 12, 256);
    expect(Math.max(...p.filter((_v, i) => i % 2 === 0))).toBeCloseTo(1, 8);
    expect(Math.min(...p.filter((_v, i) => i % 2 === 1))).toBeCloseTo(0, 8);
    expect(signedArea(p) * 240 * 40).toBeCloseTo(240 * 40 - (4 - Math.PI) * 12 * 12, -1);
  });
  it.each([[], [0, 0, 1], [0, 0, 1, 0, 2, 0], [0, 0, NaN, 1, 1, 0]].map((points) => ({ points })))(
    'rejects malformed contours $points',
    ({ points }) => {
      expect(() => normalizeContour(points)).toThrow();
    },
  );
  it('rejects invalid samples and unbounded input', () => {
    expect(() => resampleContour(square, 7)).toThrow();
    expect(() => roundedRectangle(0, 1, 1)).toThrow();
    expect(() => flattenCubics([[0, 0, 1]])).toThrow();
  });
});
