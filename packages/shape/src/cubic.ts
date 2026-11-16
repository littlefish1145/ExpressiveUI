import type { Contour } from './geometry.js';
import { normalizedRadii } from './geometry.js';
import type { CornerRadii } from './geometry.js';
export function roundedRectangleCubics(
  width: number,
  height: number,
  radius: number | CornerRadii,
  output: Float64Array = new Float64Array(64),
) {
  const [tl, tr, br, bl] = normalizedRadii(width, height, radius),
    k = 0.5522847498307936;
  if (output.length !== 64) throw new RangeError('Rounded rectangle uses eight cubic segments');
  const curves = [
    [width - tr, 0, width - tr + k * tr, 0, width, tr - k * tr, width, tr],
    [width, tr, width, tr, width, height - br, width, height - br],
    [
      width,
      height - br,
      width,
      height - br + k * br,
      width - br + k * br,
      height,
      width - br,
      height,
    ],
    [width - br, height, width - br, height, bl, height, bl, height],
    [bl, height, bl - k * bl, height, 0, height - bl + k * bl, 0, height - bl],
    [0, height - bl, 0, height - bl, 0, tl, 0, tl],
    [0, tl, 0, tl - k * tl, tl - k * tl, 0, tl, 0],
    [tl, 0, tl, 0, width - tr, 0, width - tr, 0],
  ];
  let index = 0;
  for (const curve of curves)
    for (let i = 0; i < 8; i++) output[index++] = curve[i]! / (i % 2 ? height : width);
  return output;
}
export function cubicPath(cubics: ArrayLike<number>, scale = 1000) {
  if (!cubics.length || cubics.length % 8)
    throw new RangeError('Cubic path needs complete segments');
  let d = `M${(cubics[0]! * scale).toFixed(6)} ${(cubics[1]! * scale).toFixed(6)}`;
  for (let i = 0; i < cubics.length; i += 8)
    d += `C${(cubics[i + 2]! * scale).toFixed(6)} ${(cubics[i + 3]! * scale).toFixed(6)} ${(cubics[i + 4]! * scale).toFixed(6)} ${(cubics[i + 5]! * scale).toFixed(6)} ${(cubics[i + 6]! * scale).toFixed(6)} ${(cubics[i + 7]! * scale).toFixed(6)}`;
  return d + 'Z';
}
export function sampleCubics(
  cubics: ArrayLike<number>,
  count = 128,
  output: Contour = new Float64Array(count * 2),
) {
  const segments = cubics.length / 8;
  if (!Number.isInteger(segments) || segments < 1 || output.length !== count * 2)
    throw new RangeError('Invalid cubic samples');
  for (let i = 0; i < count; i++) {
    const phase = (i * segments) / count,
      segment = Math.floor(phase) * 8,
      t = phase - Math.floor(phase),
      s = 1 - t;
    for (let axis = 0; axis < 2; axis++)
      output[i * 2 + axis] =
        s * s * s * cubics[segment + axis]! +
        3 * s * s * t * cubics[segment + 2 + axis]! +
        3 * s * t * t * cubics[segment + 4 + axis]! +
        t * t * t * cubics[segment + 6 + axis]!;
  }
  return output;
}
/** Skia Path.getBounds returns the control-point hull, used by Compose processPath for centering. */
export function cubicControlBounds(cubics: ArrayLike<number>) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let i = 0; i < cubics.length; i += 2) {
    minX = Math.min(minX, cubics[i]!);
    minY = Math.min(minY, cubics[i + 1]!);
    maxX = Math.max(maxX, cubics[i]!);
    maxY = Math.max(maxY, cubics[i + 1]!);
  }
  return { minX, minY, maxX, maxY };
}
