import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function checkPackage(directory) {
  const pkg = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
  if (!pkg.name.startsWith('@epui/') || pkg.private)
    throw Error(`Unexpected publish target: ${pkg.name}`);
  if (
    pkg.publishConfig?.access !== 'public' ||
    pkg.publishConfig?.registry !== 'https://registry.npmjs.org/'
  )
    throw Error(`Missing public npm registry configuration: ${pkg.name}`);
  if (!pkg.repository?.directory || !pkg.license || !pkg.description)
    throw Error(`Missing package metadata: ${pkg.name}`);
  const targets = (value) =>
    typeof value === 'string' ? [value] : Object.values(value).flatMap(targets);
  for (const file of new Set([pkg.main, pkg.types, ...targets(pkg.exports)])) {
    if (!file?.startsWith('./dist/') || file.includes('..', 2))
      throw Error(`Invalid export path ${file} in ${pkg.name}`);
    await access(resolve(directory, file));
  }
  for (const file of ['README.md', 'LICENSE', 'NOTICE']) await access(resolve(directory, file));
  for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
    if (name.startsWith('@epui/') && version !== `^${pkg.version}`)
      throw Error(`Internal dependency version mismatch: ${pkg.name} -> ${name}@${version}`);
  }
  return pkg;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await checkPackage(process.cwd());
