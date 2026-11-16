export type Contour = Float64Array;
export type Cubic = readonly [number, number, number, number, number, number, number, number];
const EPS = 1e-10;
const distance = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
export function signedArea(points: ArrayLike<number>): number {
  let area = 0;
  for (let i = 0; i < points.length; i += 2) {
    const j = (i + 2) % points.length;
    area += points[i]! * points[j + 1]! - points[j]! * points[i + 1]!;
  }
  return area / 2;
}
/** Strip consecutive duplicates and optional closing point; normalize clockwise in screen coordinates. */
export function normalizeContour(input: ArrayLike<number>): Contour {
  if (input.length < 6 || input.length % 2)
    throw new RangeError('A contour needs at least three XY pairs');
  const values: number[] = [];
  for (let i = 0; i < input.length; i += 2) {
    const x = input[i]!,
      y = input[i + 1]!;
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new TypeError('Non-finite geometry');
    if (!values.length || distance(x, y, values.at(-2)!, values.at(-1)!) > EPS) values.push(x, y);
  }
  if (distance(values[0]!, values[1]!, values.at(-2)!, values.at(-1)!) <= EPS) values.splice(-2);
  if (values.length < 6 || Math.abs(signedArea(values)) < EPS)
    throw new RangeError('Degenerate contour');
  if (signedArea(values) < 0) {
    const reversed: number[] = [];
    for (let i = values.length - 2; i >= 0; i -= 2) reversed.push(values[i]!, values[i + 1]!);
    return new Float64Array(reversed);
  }
  return new Float64Array(values);
}
export function resampleContour(input: ArrayLike<number>, count = 128): Contour {
  if (!Number.isInteger(count) || count < 8 || count > 2048)
    throw new RangeError('Sample count must be an integer in [8,2048]');
  const points = normalizeContour(input),
    n = points.length / 2;
  const lengths = new Float64Array(n + 1);
  for (let i = 0; i < n; i++)
    lengths[i + 1] =
      lengths[i]! +
      distance(
        points[i * 2]!,
        points[i * 2 + 1]!,
        points[((i + 1) % n) * 2]!,
        points[((i + 1) % n) * 2 + 1]!,
      );
  const total = lengths[n]!;
  const output = new Float64Array(count * 2);
  let segment = 0;
  for (let i = 0; i < count; i++) {
    const d = (total * i) / count;
    while (segment < n - 1 && lengths[segment + 1]! < d) segment++;
    const a = segment * 2,
      b = ((segment + 1) % n) * 2;
    const t = (d - lengths[segment]!) / (lengths[segment + 1]! - lengths[segment]!);
    output[i * 2] = points[a]! + (points[b]! - points[a]!) * t;
    output[i * 2 + 1] = points[a + 1]! + (points[b + 1]! - points[a + 1]!) * t;
  }
  return output;
}
/** Adaptive cubic subdivision; maxDepth bounds pathological input. */
export function flattenCubics(cubics: readonly (readonly number[])[], tolerance = 0.0001): Contour {
  if (!Number.isFinite(tolerance) || tolerance <= 0)
    throw new RangeError('Positive tolerance required');
  const points: number[] = [];
  function flatten(c: readonly number[], depth: number) {
    const [ax, ay, bx, by, cx, cy, dx, dy] = c as Cubic;
    const chord = distance(ax, ay, dx, dy);
    const net = distance(ax, ay, bx, by) + distance(bx, by, cx, cy) + distance(cx, cy, dx, dy);
    if (depth >= 14 || net - chord <= tolerance) {
      points.push(ax, ay);
      return;
    }
    const abx = (ax + bx) / 2,
      aby = (ay + by) / 2,
      bcx = (bx + cx) / 2,
      bcy = (by + cy) / 2,
      cdx = (cx + dx) / 2,
      cdy = (cy + dy) / 2;
    const ex = (abx + bcx) / 2,
      ey = (aby + bcy) / 2,
      fx = (bcx + cdx) / 2,
      fy = (bcy + cdy) / 2;
    const gx = (ex + fx) / 2,
      gy = (ey + fy) / 2;
    flatten([ax, ay, abx, aby, ex, ey, gx, gy], depth + 1);
    flatten([gx, gy, fx, fy, cdx, cdy, dx, dy], depth + 1);
  }
  if (!cubics.length) throw new RangeError('Empty cubic path');
  for (const c of cubics) {
    if (c.length !== 8 || c.some((v) => !Number.isFinite(v)))
      throw new TypeError('A cubic needs 8 finite coordinates');
    flatten(c, 0);
  }
  return normalizeContour(points);
}
export function alignContours(from: ArrayLike<number>, to: ArrayLike<number>, count = 128) {
  const a = resampleContour(from, count),
    b = resampleContour(to, count);
  let best = Infinity,
    phase = 0;
  for (let offset = 0; offset < count; offset++) {
    let cost = 0;
    for (let i = 0; i < count; i++) {
      const j = (i + offset) % count;
      cost += (a[i * 2]! - b[j * 2]!) ** 2 + (a[i * 2 + 1]! - b[j * 2 + 1]!) ** 2;
      if (cost > best) break;
    }
    if (cost < best) {
      best = cost;
      phase = offset;
    }
  }
  const aligned = new Float64Array(count * 2);
  for (let i = 0; i < count; i++) {
    const j = (i + phase) % count;
    aligned[i * 2] = b[j * 2]!;
    aligned[i * 2 + 1] = b[j * 2 + 1]!;
  }
  return { from: a, to: aligned };
}
/** Align only the destination. Preserve every source index and its instantaneous velocity. */
export function alignContourTarget(reference: ArrayLike<number>, target: ArrayLike<number>) {
  if (reference.length < 16 || reference.length % 2)
    throw new RangeError('Invalid reference contour');
  for (let i = 0; i < reference.length; i++)
    if (!Number.isFinite(reference[i])) throw new TypeError('Non-finite reference');
  const count = reference.length / 2,
    b = resampleContour(target, count);
  let best = Infinity,
    phase = 0;
  for (let offset = 0; offset < count; offset++) {
    let cost = 0;
    for (let i = 0; i < count; i++) {
      const j = (i + offset) % count;
      cost += (reference[i * 2]! - b[j * 2]!) ** 2 + (reference[i * 2 + 1]! - b[j * 2 + 1]!) ** 2;
      if (cost > best) break;
    }
    if (cost < best) {
      best = cost;
      phase = offset;
    }
  }
  const output = new Float64Array(reference.length);
  for (let i = 0; i < count; i++) {
    const j = (i + phase) % count;
    output[i * 2] = b[j * 2]!;
    output[i * 2 + 1] = b[j * 2 + 1]!;
  }
  return output;
}
/** t is deliberately not clamped: spatial springs may overshoot. Reuses output. */
export function interpolateContour(
  from: ArrayLike<number>,
  to: ArrayLike<number>,
  t: number,
  output: Contour = new Float64Array(from.length),
): Contour {
  if (from.length !== to.length || output.length !== from.length)
    throw new RangeError('Contour lengths must match');
  if (!Number.isFinite(t)) throw new TypeError('Non-finite progress');
  for (let i = 0; i < from.length; i++) output[i] = from[i]! + (to[i]! - from[i]!) * t;
  return output;
}
/** Circular corners in CSS pixels even on non-square boxes. */
export type CornerRadii = readonly [number, number, number, number];
export function normalizedRadii(
  width: number,
  height: number,
  radius: number | CornerRadii,
): [number, number, number, number] {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    throw new RangeError('Invalid rectangle dimensions');
  if (typeof radius !== 'number' && radius.length !== 4)
    throw new RangeError('Four corner radii required');
  const values = (typeof radius === 'number' ? [radius, radius, radius, radius] : [...radius]).map(
    (r) => {
      if (typeof r !== 'number' || (!Number.isFinite(r) && r !== Infinity) || r < 0)
        throw new RangeError('Invalid corner radius');
      return r === Infinity ? Math.min(width, height) / 2 : r;
    },
  );
  const [tl, tr, br, bl] = values as [number, number, number, number];
  const scale = Math.min(
    1,
    width / (tl + tr || 1),
    width / (bl + br || 1),
    height / (tl + bl || 1),
    height / (tr + br || 1),
  );
  return values.map((v) => v * scale) as [number, number, number, number];
}
export function roundedRectangle(
  width: number,
  height: number,
  radius: number | CornerRadii,
  count = 128,
): Contour {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    (typeof radius === 'number' && (Number.isNaN(radius) || radius < 0))
  )
    throw new RangeError('Invalid rectangle dimensions');
  const [tl, tr, br, bl] = normalizedRadii(width, height, radius),
    rs = [tr, br, bl, tl],
    points: number[] = [];
  const centers = [
    [width - tr, tr],
    [width - br, height - br],
    [bl, height - bl],
    [tl, tl],
  ];
  for (let corner = 0; corner < 4; corner++) {
    const [cx, cy] = centers[corner]!;
    const r = rs[corner]!;
    for (let j = 0; j <= 32; j++) {
      const angle = -Math.PI / 2 + (corner * Math.PI) / 2 + ((Math.PI / 2) * j) / 32;
      points.push((cx! + Math.cos(angle) * r) / width, (cy! + Math.sin(angle) * r) / height);
    }
  }
  return resampleContour(points, count);
}
export function contourPath(points: ArrayLike<number>, scale = 1000): string {
  let path = '';
  for (let i = 0; i < points.length; i += 2)
    path +=
      (i ? 'L' : 'M') + (points[i]! * scale).toFixed(3) + ' ' + (points[i + 1]! * scale).toFixed(3);
  return path + 'Z';
}
