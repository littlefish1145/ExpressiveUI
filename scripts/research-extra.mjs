import { readFile, writeFile } from 'node:fs/promises';
const refs = JSON.parse(await readFile('docs/references/sources.json', 'utf8'));
const { repo, sha } = refs.refs.compose;
const base = 'compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/';
const listing = await fetch(
  `https://api.github.com/repos/${repo}/contents/${base}tokens?ref=${sha}`,
).then((r) => r.json());
const paths = listing
  .filter((f) =>
    /Fab|Floating|LoadingIndicator|TypeScale|Typography|Button(Small|Medium|Large|XLarge|XSmall)Baseline|FilledButton|StateTokens/.test(
      f.name,
    ),
  )
  .map((f) => base + 'tokens/' + f.name);
paths.push(base + 'Button.kt', base + 'FloatingActionButton.kt');
for (const path of paths) {
  const url = `https://raw.githubusercontent.com/${repo}/${sha}/${path}`;
  const r = await fetch(url);
  if (r.ok) {
    const file = 'compose-' + path.split('/').at(-1);
    await writeFile('docs/references/' + file, await r.text());
    refs.records.push({ key: 'compose', path, url, status: 200, file });
    console.log(file);
  }
}
await writeFile('docs/references/sources.json', JSON.stringify(refs, null, 2) + '\n');
