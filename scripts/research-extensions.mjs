import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const filename = 'docs/references/sources.json',
  manifest = JSON.parse(await readFile(filename, 'utf8'));
if (!manifest.refs.mdcweb) {
  const r = await fetch(
    'https://api.github.com/repos/material-components/material-components-web/commits/HEAD',
  );
  if (!r.ok) throw Error(`MDC source revision: ${r.status}`);
  const commit = await r.json();
  manifest.refs.mdcweb = { repo: 'material-components/material-components-web', sha: commit.sha };
}
const ref = manifest.refs.mdcweb;
for (const path of [
  'LICENSE',
  'packages/mdc-data-table/_data-table-theme.scss',
  'packages/mdc-data-table/_data-table.scss',
  'packages/mdc-banner/_banner-theme.scss',
  'packages/mdc-banner/_banner.scss',
]) {
  const url = `https://raw.githubusercontent.com/${ref.repo}/${ref.sha}/${path}`,
    response = await fetch(url);
  if (!response.ok) throw Error(`${response.status} ${path}`);
  const bytes = Buffer.from(await response.arrayBuffer()),
    file = 'mdcweb-' + path.split('/').slice(-2).join('-');
  await writeFile('docs/references/' + file, bytes);
  const record = {
    key: 'mdcweb',
    path,
    url,
    status: 200,
    file,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
  const index = manifest.records.findIndex((r) => r.key === record.key && r.path === path);
  if (index < 0) manifest.records.push(record);
  else manifest.records[index] = record;
}
await writeFile(filename, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Pinned MDC Web table/banner references at ${ref.sha}`);
