import { build } from 'esbuild';
import { writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
await mkdir('.cache', { recursive: true });
await build({
  entryPoints: ['packages/theme/src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: '.cache/theme.mjs',
});
const { generateTheme, themeToCSS, themePresets } = await import(
  pathToFileURL(resolve('.cache/theme.mjs'))
);
const light = generateTheme({ seed: '#6750a4' }),
  dark = generateTheme({ seed: '#6750a4', dark: true });
const css =
  '/* Generated from official MCU 0.3.0 tonal-spot seed #6750a4, contrast 0. */\n@layer expressive-ui {\n' +
  themeToCSS(light, ':root') +
  themeToCSS(dark, ':root[data-theme="dark"]') +
  '@media(prefers-color-scheme:dark) {\n' +
  themeToCSS(dark, ':root:not([data-theme="light"])') +
  '}\n}\n';
await writeFile('packages/components/src/theme.css', css);
const previews = {};
for (const preset of themePresets)
  for (const dark of [false, true])
    previews[`${preset.id}|${dark}|0`] = generateTheme({ ...preset, dark });
await writeFile('playground/src/default-themes.json', JSON.stringify({ light, dark, previews }));
console.log('Generated light/dark fallback themes:', Object.keys(light.colors).length, 'roles.');
