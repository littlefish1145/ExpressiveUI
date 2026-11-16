import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const manifest = 'docs/references/sources.json';
const sources = JSON.parse(await readFile(manifest, 'utf8'));
const { repo, sha } = sources.refs.compose;
const base = 'compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/';
const response = await fetch(
  `https://api.github.com/repos/${repo}/contents/${base}tokens?ref=${sha}`,
);
if (!response.ok) throw Error(String(response.status));
const listing = await response.json();
const paths = listing
  .filter((file) => /IconButton|^(Checkbox|RadioButton|Slider)/.test(file.name))
  .map((file) => base + 'tokens/' + file.name);
paths.push(
  ...[
    'IconButton.kt',
    'IconButtonDefaults.kt',
    'Checkbox.kt',
    'RadioButton.kt',
    'Slider.kt',
    'ComposeMaterial3Flags.kt',
  ].map((name) => base + name),
);
const records = await Promise.all(
  paths.map(async (path) => {
    const url = `https://raw.githubusercontent.com/${repo}/${sha}/${path}`;
    const r = await fetch(url);
    if (!r.ok) throw Error(`${r.status} ${url}`);
    const body = await r.text(),
      file = 'compose-' + path.split('/').at(-1);
    await writeFile('docs/references/' + file, body);
    return {
      key: 'compose',
      path,
      url,
      status: 200,
      file,
      sha256: createHash('sha256').update(body).digest('hex'),
    };
  }),
);
for (const record of records) {
  const index = sources.records.findIndex((x) => x.path === record.path && x.key === record.key);
  if (index < 0) sources.records.push(record);
  else sources.records[index] = record;
}
await writeFile(manifest, JSON.stringify(sources, null, 2) + '\n');
console.log(records.map((x) => x.file).join('\n'));
