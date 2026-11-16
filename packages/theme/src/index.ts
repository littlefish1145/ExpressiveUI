import {
  Hct,
  argbFromHex,
  hexFromArgb,
  SchemeTonalSpot,
  SchemeExpressive,
  SchemeVibrant,
  SchemeNeutral,
  SchemeMonochrome,
  SchemeFidelity,
  SchemeContent,
  SchemeRainbow,
  SchemeFruitSalad,
} from '@material/material-color-utilities';
export * from './runtime.js';
export * from './presets.js';
const variants = {
  'tonal-spot': SchemeTonalSpot,
  expressive: SchemeExpressive,
  vibrant: SchemeVibrant,
  neutral: SchemeNeutral,
  monochrome: SchemeMonochrome,
  fidelity: SchemeFidelity,
  content: SchemeContent,
  rainbow: SchemeRainbow,
  'fruit-salad': SchemeFruitSalad,
} as const;
export type ThemeVariant = keyof typeof variants;
export interface ThemeOptions {
  seed: string;
  dark?: boolean;
  contrast?: number;
  variant?: ThemeVariant;
}
export const colorRoles = [
  'primary',
  'onPrimary',
  'primaryContainer',
  'onPrimaryContainer',
  'inversePrimary',
  'secondary',
  'onSecondary',
  'secondaryContainer',
  'onSecondaryContainer',
  'tertiary',
  'onTertiary',
  'tertiaryContainer',
  'onTertiaryContainer',
  'error',
  'onError',
  'errorContainer',
  'onErrorContainer',
  'background',
  'onBackground',
  'surface',
  'onSurface',
  'surfaceVariant',
  'onSurfaceVariant',
  'surfaceDim',
  'surfaceBright',
  'surfaceContainerLowest',
  'surfaceContainerLow',
  'surfaceContainer',
  'surfaceContainerHigh',
  'surfaceContainerHighest',
  'outline',
  'outlineVariant',
  'inverseSurface',
  'inverseOnSurface',
  'shadow',
  'scrim',
  'primaryFixed',
  'primaryFixedDim',
  'onPrimaryFixed',
  'onPrimaryFixedVariant',
  'secondaryFixed',
  'secondaryFixedDim',
  'onSecondaryFixed',
  'onSecondaryFixedVariant',
  'tertiaryFixed',
  'tertiaryFixedDim',
  'onTertiaryFixed',
  'onTertiaryFixedVariant',
] as const;
export type ColorRole = (typeof colorRoles)[number];
export interface Theme {
  readonly colors: Readonly<Record<ColorRole, string>>;
  readonly variables: Readonly<Record<string, string>>;
  readonly dark: boolean;
}
export function generateTheme(options: ThemeOptions): Theme {
  if (!/^#[\da-f]{6}$/i.test(options.seed)) throw new TypeError('seed must be #RRGGBB');
  const contrast = options.contrast ?? 0;
  if (!Number.isFinite(contrast) || contrast < -1 || contrast > 1)
    throw new RangeError('contrast must be in [-1, 1]');
  const Constructor = variants[options.variant ?? 'tonal-spot'];
  if (!Constructor) throw new TypeError('Unknown theme variant');
  const dark = options.dark ?? false;
  const scheme = new Constructor(Hct.fromInt(argbFromHex(options.seed)), dark, contrast);
  const colors = {} as Record<ColorRole, string>;
  const variables: Record<string, string> = {};
  for (const role of colorRoles) {
    const hex = hexFromArgb(scheme[role]);
    colors[role] = hex;
    variables['--md-sys-color-' + role.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())] = hex;
  }
  return Object.freeze({
    colors: Object.freeze(colors),
    variables: Object.freeze(variables),
    dark,
  });
}
export function themeToCSS(theme: Theme, selector = ':root'): string {
  if (/[{}]/.test(selector)) throw new TypeError('Invalid CSS selector');
  return `${selector} {\n${Object.entries(theme.variables)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')}\n  color-scheme: ${theme.dark ? 'dark' : 'light'};\n}\n`;
}
