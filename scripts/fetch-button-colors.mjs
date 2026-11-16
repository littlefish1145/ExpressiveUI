import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const manifest = 'docs/references/sources.json';
const sources = JSON.parse(await readFile(manifest, 'utf8'));
for (const name of [
  'FilledTonalButtonTokens',
  'OutlinedButtonTokens',
  'TextButtonTokens',
  'ElevatedButtonTokens',
]) {
  const path = `compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/${name}.kt`;
  const url = `https://raw.githubusercontent.com/androidx/androidx/${sources.refs.compose.sha}/${path}`;
  const r = await fetch(url);
  if (!r.ok) throw Error(`${r.status} ${url}`);
  const body = await r.text();
  const file = 'compose-' + name + '.kt';
  await writeFile('docs/references/' + file, body);
  sources.records.push({
    key: 'compose',
    path,
    url,
    status: 200,
    file,
    sha256: createHash('sha256').update(body).digest('hex'),
  });
  console.log(
    body
      .split('\n')
      .filter((l) => /Color|Opacity|OutlineWidth|get\(\) = Color/.test(l))
      .join('\n'),
  );
}
await writeFile(manifest, JSON.stringify(sources, null, 2) + '\n');
