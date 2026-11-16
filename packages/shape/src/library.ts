import { materialShapes } from './material-shapes.js';
import {
  flattenCubics,
  resampleContour,
  roundedRectangle,
  alignContours,
  interpolateContour,
} from './geometry.js';
import type { Contour } from './geometry.js';
import { sampleCubics, roundedRectangleCubics } from './cubic.js';
import type { CornerRadii } from './geometry.js';
import { peekMorphData, prepareMorphData } from './official-morph.js';
import { materialBounds } from './material-bounds.js';
export type PolygonShape = keyof typeof materialShapes;
export type RoundedShape =
  | 'none'
  | 'extraSmall'
  | 'small'
  | 'medium'
  | 'large'
  | 'largeIncreased'
  | 'extraLarge'
  | 'extraLargeIncreased'
  | 'extraExtraLarge'
  | 'full';
export type AsymmetricRoundedShape =
  'extraSmallTop' | 'largeTop' | 'largeStart' | 'largeEnd' | 'extraLargeTop';
export type ShapeToken = PolygonShape | `rounded:${RoundedShape | AsymmetricRoundedShape}`;
export const shapeNames = /* @__PURE__ */ Object.freeze(
  /* @__PURE__ */ Object.keys(materialShapes) as PolygonShape[],
);
const radii: Record<RoundedShape | AsymmetricRoundedShape, number | CornerRadii> = {
  extraSmallTop: [4, 4, 0, 0],
  largeTop: [16, 16, 0, 0],
  largeStart: [16, 0, 0, 16],
  largeEnd: [0, 16, 16, 0],
  extraLargeTop: [28, 28, 0, 0],
  none: 0,
  extraSmall: 4,
  small: 8,
  medium: 12,
  large: 16,
  largeIncreased: 20,
  extraLarge: 28,
  extraLargeIncreased: 32,
  extraExtraLarge: 48,
  full: Infinity,
};
function tokenRadii(token: ShapeToken, direction: 'ltr' | 'rtl') {
  const radius = radii[token.slice(8) as RoundedShape | AsymmetricRoundedShape];
  if (radius === undefined) throw new TypeError('Unknown rounded shape token');
  return direction === 'rtl' && typeof radius !== 'number'
    ? ([radius[1], radius[0], radius[3], radius[2]] as CornerRadii)
    : radius;
}
const cache = new Map<string, Contour>();
const morphCache = new Map<string, { from: Contour; to: Contour }>();
const MAX_CACHE = 64;
function put<T>(map: Map<string, T>, key: string, value: T): T {
  map.delete(key);
  map.set(key, value);
  if (map.size > MAX_CACHE) map.delete(map.keys().next().value!);
  return value;
}
/** Returns a copy so consumers cannot corrupt shared cached data. Polygon dimensions are normalized. */
export function getShape(
  token: ShapeToken,
  width = 100,
  height = 100,
  count = 128,
  direction: 'ltr' | 'rtl' = 'ltr',
): Contour {
  const key = token.startsWith('rounded:')
    ? `${token}:${width}:${height}:${count}:${direction}`
    : `${token}:${count}`;
  let shape = cache.get(key);
  if (!shape) {
    if (token.startsWith('rounded:')) {
      const radius = tokenRadii(token, direction);
      shape = roundedRectangle(width, height, radius, count);
    } else {
      const cubics = materialShapes[token as PolygonShape];
      if (!cubics) throw new TypeError('Unknown Material shape');
      shape = resampleContour(flattenCubics(cubics), count);
    }
    put(cache, key, shape);
  } else {
    put(cache, key, shape);
  }
  return shape.slice();
}
export function createMorph(
  from: ShapeToken,
  to: ShapeToken,
  options: { width?: number; height?: number; count?: number; direction?: 'ltr' | 'rtl' } = {},
) {
  const { width = 100, height = 100, count = 128, direction = 'ltr' } = options;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    !Number.isInteger(count) ||
    count < 8 ||
    count > 2048
  )
    throw new RangeError('Invalid morph dimensions or sample count');
  if (from.startsWith('rounded:') && to.startsWith('rounded:')) {
    const a = roundedRectangleCubics(width, height, tokenRadii(from, direction)),
      b = roundedRectangleCubics(width, height, tokenRadii(to, direction)),
      out = new Float64Array(64),
      points = new Float64Array(count * 2);
    return {
      ready: Promise.resolve(),
      exact: true,
      cubicsAt(progress: number) {
        return interpolateContour(a, b, progress, out);
      },
      at(progress: number) {
        return sampleCubics(interpolateContour(a, b, progress, out), count, points);
      },
    };
  }
  if (!from.startsWith('rounded:') && !to.startsWith('rounded:')) {
    if (!materialShapes[from as PolygonShape] || !materialShapes[to as PolygonShape])
      throw new TypeError('Unknown shape token');
    const key = `${from}|${to}`;
    let data =
      from === to
        ? ([
            materialShapes[from as PolygonShape].flat(),
            materialShapes[to as PolygonShape].flat(),
          ] as const)
        : peekMorphData(key);
    let a: Contour | undefined, b: Contour | undefined, cubics: Float64Array | undefined;
    const output = new Float64Array(count * 2);
    const initialize = () => {
      if (!data) return;
      a = sampleCubics(data[0], count);
      b = sampleCubics(data[1], count);
      cubics = new Float64Array(data[0].length);
    };
    initialize();
    const ready = data
      ? Promise.resolve()
      : prepareMorphData(key).then((value) => {
          data = value;
          initialize();
        });
    return {
      ready,
      get exact() {
        return !!data;
      },
      at(progress: number) {
        if (!a || !b) {
          if (progress === 0) return getShape(from, width, height, count);
          if (progress === 1) return getShape(to, width, height, count);
          throw new Error('Await morph.ready before interpolation');
        }
        return interpolateContour(a, b, progress, output);
      },
      cubicsAt(progress: number) {
        if (!data || !cubics) {
          if (progress === 0 || progress === 1)
            return new Float64Array(
              materialShapes[(progress === 0 ? from : to) as PolygonShape].flat(),
            );
          throw new Error('Await morph.ready before interpolation');
        }
        return interpolateContour(data[0], data[1], progress, cubics);
      },
    };
  }
  const key = `${from}|${to}|${width}|${height}|${count}|${direction}`;
  let pair = morphCache.get(key);
  if (!pair)
    pair = put(
      morphCache,
      key,
      alignContours(
        getShape(from, width, height, count, direction),
        getShape(to, width, height, count, direction),
        count,
      ),
    );
  const output = new Float64Array(count * 2);
  return {
    ready: Promise.resolve(),
    exact: false,
    cubicsAt(_progress: number): Float64Array | null {
      return null;
    },
    at(progress: number) {
      return interpolateContour(pair.from, pair.to, progress, output);
    },
  };
}
export function shapeRotationScale(tokens: readonly PolygonShape[]) {
  let scale = 1;
  for (const token of tokens) {
    const b = materialBounds[token]!;
    scale = Math.min(
      scale,
      Math.max(
        (b.bounds[2]! - b.bounds[0]!) / (b.maxBounds[2]! - b.maxBounds[0]!),
        (b.bounds[3]! - b.bounds[1]!) / (b.maxBounds[3]! - b.maxBounds[1]!),
      ),
    );
  }
  return scale;
}
export function clearShapeCache(): void {
  cache.clear();
  morphCache.clear();
}
export function shapeCacheStats() {
  return { shapes: cache.size, morphs: morphCache.size, limit: MAX_CACHE };
}
