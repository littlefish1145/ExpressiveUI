import { createSpring, motionPreset } from './runtime.js';
import type { SpringParameters } from './spring.js';
export type RGBA = readonly [number, number, number, number];
export type Oklab = readonly [number, number, number, number];
const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
export function parseColor(css: string): RGBA | null {
  const value = css.trim().toLowerCase();
  if (value === 'transparent') return [0, 0, 0, 0];
  const names: Record<string, string> = {
    black: '#000000',
    white: '#ffffff',
    red: '#ff0000',
    blue: '#0000ff',
    green: '#008000',
  };
  if (names[value]) return parseColor(names[value]!);
  const hex = value.match(/^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i);
  if (hex) {
    let h = hex[1]!;
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    return [
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255,
      h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    ];
  }
  const rgb = value.match(/^rgba?\((.*)\)$/);
  if (rgb) {
    const parts = rgb[1]!.replaceAll(',', ' ').replace('/', ' ').split(/\s+/).filter(Boolean);
    if (parts.length < 3 || parts.length > 4) return null;
    const values = parts.map((p, i) => parseFloat(p) / (p.endsWith('%') ? 100 : i < 3 ? 255 : 1));
    if (values.some((v) => !Number.isFinite(v))) return null;
    return [clamp(values[0]!), clamp(values[1]!), clamp(values[2]!), clamp(values[3] ?? 1)];
  }
  const srgb = value.match(/^color\(srgb\s+(.*)\)$/);
  if (srgb) {
    const p = srgb[1]!.replace('/', ' ').split(/\s+/).map(Number);
    if (p.length >= 3 && p.every(Number.isFinite))
      return [clamp(p[0]!), clamp(p[1]!), clamp(p[2]!), clamp(p[3] ?? 1)];
  }
  return null;
}
/** sRGB ↔ Oklab: CSS Color 4 sample matrices, D65. Compose Color.VectorConverter uses Oklab. */
export function rgbaToOklab([r, g, b, a]: RGBA): Oklab {
  const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  r = linear(r);
  g = linear(g);
  b = linear(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b),
    m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b),
    s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    a,
  ];
}
export function oklabToRgba([light, a, b, alpha]: Oklab): RGBA {
  const L = clamp(light);
  a = clamp(a, -0.5, 0.5);
  b = clamp(b, -0.5, 0.5);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3,
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3,
    s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const srgb = (c: number) =>
    clamp(c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(0, c) ** (1 / 2.4) - 0.055);
  return [
    srgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    srgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    srgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    clamp(alpha),
  ];
}
export function colorCSS(color: RGBA) {
  return `rgba(${(color[0] * 255).toFixed(4)}, ${(color[1] * 255).toFixed(4)}, ${(color[2] * 255).toFixed(4)}, ${color[3].toFixed(6)})`;
}
export function createColorSpring(
  initial: RGBA,
  render: (color: RGBA) => void,
  parameters: SpringParameters = motionPreset('expressive', 'default.effects'),
) {
  const vector = [...rgbaToOklab(initial)] as [number, number, number, number];
  const springs = vector.map((value, index) =>
    createSpring(
      value,
      (next) => {
        vector[index] = next;
        render(oklabToRgba(vector));
      },
      { ...parameters, positionThreshold: 0.001, velocityThreshold: 0.01 },
    ),
  );
  let target = initial;
  return {
    get value() {
      return oklabToRgba(vector);
    },
    get velocity() {
      return springs.map((s) => s.velocity);
    },
    setTarget(next: RGBA, animate = true) {
      target = next;
      const v = rgbaToOklab(next);
      springs.forEach((s, i) => {
        if (animate) s.setTarget(v[i]!);
        else s.jump(v[i]!);
      });
    },
    configure(p: SpringParameters) {
      for (const s of springs) s.configure(p);
    },
    finish() {
      const v = rgbaToOklab(target);
      springs.forEach((s, i) => s.jump(v[i]!));
    },
    destroy() {
      for (const s of springs) s.destroy();
    },
  };
}
