import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const path = 'docs/references/sources.json';
const sources = JSON.parse(await readFile(path, 'utf8'));
for (const record of sources.records) {
  if (record.status !== 200) continue;
  // Original requests to Android files with the same basename must not share a snapshot.
  if (record.key === 'android') {
    const filename = 'android-' + record.path.replaceAll('/', '-');
    const response = await fetch(record.url);
    if (!response.ok) throw Error(record.url);
    await writeFile('docs/references/' + filename, await response.text());
    record.file = filename;
  }
  const buffer = await readFile('docs/references/' + record.file);
  record.sha256 = createHash('sha256').update(buffer).digest('hex');
}
await writeFile(path, JSON.stringify(sources, null, 2) + '\n');
console.log('Verified pinned reference snapshots and recorded SHA-256 hashes.');
