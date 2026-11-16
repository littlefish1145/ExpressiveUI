import { readFile, writeFile } from 'node:fs/promises';
const names = [
  'Badge',
  'AssistChip',
  'FilterChip',
  'InputChip',
  'SuggestionChip',
  'OutlinedSegmentedButton',
  'FilledCard',
  'OutlinedCard',
  'ElevatedCard',
  'Divider',
  'List',
  'ExpandedList',
  'FilledTextField',
  'OutlinedTextField',
  'NavigationBar',
  'NavigationBarVerticalItem',
  'NavigationRailCollapsed',
  'NavigationRailExpanded',
  'NavigationDrawer',
  'PrimaryNavigationTab',
  'SecondaryNavigationTab',
  'Dialog',
  'SheetBottom',
  'Menu',
  'StandardMenu',
  'Snackbar',
  'PlainTooltip',
  'RichTooltip',
  'SearchBar',
  'SearchView',
  'AppBarSmall',
  'AppBarMedium',
  'AppBarLarge',
  'AppBarMediumFlexible',
  'AppBarLargeFlexible',
  'BottomAppBar',
  'FloatingToolbar',
  'DockedToolbar',
  'ButtonGroupSmall',
  'ConnectedButtonGroupSmall',
  'SplitButtonSmall',
  'FabMenuBaseline',
  'ProgressIndicator',
  'LinearProgressIndicator',
  'CircularProgressIndicator',
  'DatePickerModal',
  'TimePicker',
  'TimeInput',
];
const manifest = JSON.parse(await readFile('docs/references/sources.json', 'utf8'));
const records = [];
const declarations = [];
for (const name of names) {
  const file = `compose-${name}Tokens.kt`,
    source = await readFile(`docs/references/${file}`, 'utf8');
  const entries = {};
  for (const match of source.matchAll(
    /(?:inline val|const val) (\w+)(?::[^=\n]+\s*get\(\))?\s*=\s*([^\r\n]+)/g,
  )) {
    const expression = match[2].trim();
    const numeric = expression.match(/^(-?[\d.]+)(?:\.dp|f)?$/);
    const value = numeric ? Number(numeric[1]) : expression;
    entries[match[1]] = value;
    records.push({
      family: name,
      key: match[1],
      value,
      expression,
      file,
      line: source.slice(0, match.index).split('\n').length,
    });
  }
  if (!Object.keys(entries).length) throw Error(`Empty token family: ${name}`);
  declarations.push(
    `export const ${name[0].toLowerCase() + name.slice(1)}Tokens = ${JSON.stringify(entries, null, 2)} as const;`,
  );
}
const ts =
  '// Generated from pinned official AndroidX tokens. Apache-2.0. dp → CSS px is a Web convention.\n' +
  declarations.join('\n') +
  '\n';
const output = 'packages/tokens/src/catalog.ts';
if (process.argv.includes('--check')) {
  if ((await readFile(output, 'utf8')) !== ts) throw Error('Stale catalog tokens');
} else await writeFile(output, ts);
await writeFile(
  'docs/references/catalog-token-values.json',
  JSON.stringify(records, null, 2) + '\n',
);
const base = `https://github.com/${manifest.refs.compose.repo}/blob/${manifest.refs.compose.sha}/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/`;
await writeFile(
  'docs/catalog-token-mapping.md',
  '# 扩展目录 Token 逐项映射\n\n由scripts/generate-catalog-tokens.mjs从固定官方源码提取。数字为原始dp/opacity值；别名表达式原样保留，未擅自解析为官方数值。dp/sp→CSS px仍为Web约定。布局中未在此表确认的参数见catalog-spec-mapping.md的平台约定。\n\n| Family | Key | Source expression | Official source |\n|---|---|---|---|\n' +
    records
      .map(
        (r) =>
          `| ${r.family} | ${r.key} | \`${r.expression}\` | [${r.file}:${r.line}](${base + r.file.slice(8)}#L${r.line}) |`,
      )
      .join('\n') +
    '\n',
);
console.log(`Verified ${records.length} tokens across ${names.length} component token families.`);
