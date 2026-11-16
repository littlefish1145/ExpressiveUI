import { build } from 'esbuild';
import { mkdir, readdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
const names = ['core', 'tokens', 'shape', 'motion', 'theme', 'components', 'adapter-react'];
for (const name of names) {
  const path = `packages/${name}`;
  const files = (await readdir(`${path}/src`, { recursive: true })).filter(
    (f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts'),
  );
  await mkdir(`${path}/dist`, { recursive: true });
  await build({
    entryPoints: files.map((f) => `${path}/src/${f}`),
    outdir: `${path}/dist`,
    outbase: `${path}/src`,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    sourcemap: true,
    minify: false,
    treeShaking: true,
    jsx: 'automatic',
    packages: 'external',
  });
  // Declarations resolve already-built lower packages, enforcing actual package boundaries.
  execFileSync(
    process.execPath,
    [resolve('node_modules/typescript/bin/tsc'), '-p', `${path}/tsconfig.build.json`],
    { stdio: 'inherit' },
  );
  for (const file of await readdir(`${path}/src`))
    if (file.endsWith('.css')) await copyFile(`${path}/src/${file}`, `${path}/dist/${file}`);
  for (const file of await readdir(`${path}/src`, { recursive: true }))
    if (/\.(woff2|txt)$/.test(file)) {
      await mkdir(dirname(`${path}/dist/${file}`), { recursive: true });
      await copyFile(`${path}/src/${file}`, `${path}/dist/${file}`);
    }
  for (const file of ['LICENSE', 'NOTICE']) await copyFile(file, `${path}/${file}`);
  console.log(`Built @expressive-ui/${name}`);
}
const graph = {};
for (const name of names) {
  const p = JSON.parse(await readFile(`packages/${name}/package.json`, 'utf8'));
  graph[name] = Object.keys(p.dependencies ?? {})
    .filter((n) => n.startsWith('@expressive-ui/'))
    .map((n) => n.split('/')[1]);
}
function visit(name, path = []) {
  if (path.includes(name)) throw Error('Circular dependency: ' + [...path, name].join(' → '));
  for (const dep of graph[name]) visit(dep, [...path, name]);
}
for (const name of names) visit(name);
await writeFile('docs/dependency-graph.json', JSON.stringify(graph, null, 2) + '\n');
console.log('Package dependency graph is acyclic.');
