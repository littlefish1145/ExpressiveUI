import { readFile, writeFile } from 'node:fs/promises';
const dimensions = (source) =>
  Object.fromEntries(
    [...source.matchAll(/(?:inline )?val (\w+):[^\n]+\s*get\(\) = ([\d.]+)\.dp/g)].map((m) => [
      m[1][0].toLowerCase() + m[1].slice(1),
      Number(m[2]),
    ]),
  );
const shapes = {
  CornerFull: 'full',
  CornerMedium: 12,
  CornerLarge: 16,
  CornerExtraLarge: 28,
  CornerSmall: 8,
};
const icons = {};
for (const [key, size] of Object.entries({
  xs: 'XSmall',
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
  xl: 'XLarge',
})) {
  const text = await readFile(`docs/references/compose-${size}IconButtonTokens.kt`, 'utf8');
  const numbers = dimensions(text);
  const shape = (property) =>
    shapes[text.match(new RegExp(`${property}:[^\\n]+\\s*get\\(\\) = ShapeKeyTokens.(\\w+)`))[1]];
  icons[key] = {
    height: numbers.containerHeight,
    icon: numbers.iconSize,
    padding: {
      narrow: numbers.narrowLeadingSpace,
      uniform: numbers.defaultLeadingSpace ?? numbers.uniformLeadingSpace,
      wide: numbers.wideLeadingSpace,
    },
    square: shape('ContainerShapeSquare'),
    pressed: shape('PressedContainerShape'),
    selectedRound: shape('SelectedContainerShapeRound'),
    selectedSquare: shape('SelectedContainerShapeSquare'),
    outline: numbers.outlinedOutlineWidth,
  };
}
const slider = dimensions(await readFile('docs/references/compose-SliderTokens.kt', 'utf8'));
const checkbox = dimensions(await readFile('docs/references/compose-CheckboxTokens.kt', 'utf8'));
const radio = dimensions(await readFile('docs/references/compose-RadioButtonTokens.kt', 'utf8'));
const data = { iconButton: icons, slider, checkbox, radio };
const ts =
  '// Generated from pinned official AndroidX token files. Apache-2.0.\n' +
  Object.entries(data)
    .map(
      ([name, values]) =>
        `export const ${name}Tokens = ${JSON.stringify(values, null, 2)} as const;`,
    )
    .join('\n') +
  '\n';
const file = 'packages/tokens/src/controls.ts';
if (process.argv.includes('--check')) {
  if ((await readFile(file, 'utf8')) !== ts) throw Error('Stale controls.ts');
} else await writeFile(file, ts);
await writeFile('docs/references/control-token-values.json', JSON.stringify(data, null, 2) + '\n');
console.log('Verified official Icon Button, Checkbox, Radio and Slider tokens.');
