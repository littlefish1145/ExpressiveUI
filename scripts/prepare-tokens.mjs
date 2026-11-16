import { access, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
let references = false;
try {
  await access('docs/references/sources.json');
  references = true;
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (references) {
  for (const script of [
    'generate-tokens.mjs',
    'generate-control-tokens.mjs',
    'generate-catalog-tokens.mjs',
  ])
    execFileSync(process.execPath, [resolve('scripts', script)], { stdio: 'inherit' });
} else {
  for (const file of ['index.ts', 'controls.ts', 'catalog.ts', 'styles.css']) {
    const content = await readFile('packages/tokens/src/' + file, 'utf8');
    if (!content.trim()) throw Error('Missing token snapshot ' + file);
  }
  console.log(
    'Using existing token snapshots: official reference cache is absent. No official-source revalidation performed; npm run tokens remains the explicit refresh command.',
  );
}
