import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const manifestPath = 'docs/references/sources.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const { repo, sha } = manifest.refs.compose;
const base = 'compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/';
const components =
  /^(AppBar|Badge|ButtonGroup|Card|Carousel|Chip|DatePicker|DateRangePicker|Divider|FloatingActionButtonMenu|FloatingToolbar|ListItem|Menu|ModalBottomSheet|NavigationBar|NavigationDrawer|NavigationRail|ProgressIndicator|SearchBar|SegmentedButton|SheetDefaults|Snackbar|SplitButton|Tab|TabRow|TextField|OutlinedTextField|TimePicker|Tooltip|WideNavigationRail|AlertDialog)\.kt$/;
const paths = [];
for (const directory of ['', 'tokens']) {
  const response = await fetch(
    `https://api.github.com/repos/${repo}/contents/${base}${directory}?ref=${sha}`,
  );
  if (!response.ok) throw Error(`Listing failed: ${response.status}`);
  const files = await response.json();
  for (const file of files)
    if (file.name.endsWith('.kt') && (directory || components.test(file.name)))
      paths.push(file.path);
}
let count = 0;
const queue = [...paths];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const path = queue.shift();
      const existing = manifest.records.find(
        (r) => r.key === 'compose' && r.path === path && r.status === 200,
      );
      if (existing) {
        count++;
        continue;
      }
      const url = `https://raw.githubusercontent.com/${repo}/${sha}/${path}`;
      const response = await fetch(url);
      if (!response.ok) throw Error(`${response.status} ${path}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const file = 'compose-' + path.split('/').at(-1);
      await writeFile('docs/references/' + file, bytes);
      manifest.records.push({
        key: 'compose',
        path,
        url,
        status: 200,
        file,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
      count++;
    }
  }),
);
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Pinned ${count} official component/token sources at ${sha}.`);
