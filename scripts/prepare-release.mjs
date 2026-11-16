import { mkdir, mkdtemp, readFile, writeFile, access, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkPackage } from './check-package.mjs';

const npmCLI = process.env.npm_execpath;
if (!npmCLI) throw Error('Run this script using npm run release:pack');
const root = process.cwd();
const destination = resolve('dist/npm');
await mkdir(destination, { recursive: true });
await rm(join(destination, 'manifest.json'), { force: true });
const names = ['core', 'tokens', 'shape', 'motion', 'theme', 'components', 'adapter-react'];
const packages = [];
for (const name of names) {
  const directory = resolve('packages', name);
  const pkg = await checkPackage(directory);
  const [packed] = JSON.parse(
    execFileSync(
      process.execPath,
      [npmCLI, 'pack', '--json', '--ignore-scripts', '--pack-destination', destination],
      { cwd: directory, encoding: 'utf8' },
    ),
  );
  const included = new Set(packed.files.map((file) => file.path));
  for (const file of packed.files)
    if (!/^(dist\/|package\.json$|README\.md$|LICENSE$|NOTICE$)/.test(file.path))
      throw Error(`Unexpected tarball file: ${pkg.name}/${file.path}`);
  for (const file of [
    'package.json',
    'README.md',
    'LICENSE',
    'NOTICE',
    pkg.main.slice(2),
    pkg.types.slice(2),
  ])
    if (!included.has(file)) throw Error(`Tarball is missing ${pkg.name}/${file}`);
  packages.push({
    name: pkg.name,
    version: pkg.version,
    filename: packed.filename,
    size: packed.size,
    unpackedSize: packed.unpackedSize,
    integrity: packed.integrity,
    exports: pkg.exports,
  });
  console.log(`${pkg.name}@${pkg.version}: ${packed.size} B packed, ${packed.files.length} files`);
}

// A separate project avoids resolving source aliases or workspace symlinks.
const consumer = await mkdtemp(join(tmpdir(), 'expressive-ui-npm-'));
await writeFile(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
execFileSync(
  process.execPath,
  [
    npmCLI,
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--package-lock=false',
    ...packages.map((pkg) => join(destination, pkg.filename)),
    'react@18.3.1',
    '@types/react@18.3.1',
  ],
  { cwd: consumer, stdio: 'inherit' },
);
const imports = [];
const typeImports = [];
for (const pkg of packages) {
  for (const [subpath, target] of Object.entries(pkg.exports)) {
    const specifier = pkg.name + (subpath === '.' ? '' : subpath.slice(1));
    if (typeof target === 'string')
      imports.push(
        `await access(fileURLToPath(import.meta.resolve(${JSON.stringify(specifier)})));`,
      );
    else {
      imports.push(`await import(${JSON.stringify(specifier)});`);
      typeImports.push(`import * as m${typeImports.length} from ${JSON.stringify(specifier)};`);
    }
  }
}
imports.push(`const { createMorph } = await import('@amiracle1024/shape');
const morph = createMorph('heart', 'circle'); await morph.ready;
if (!morph.exact || !morph.cubicsAt(0.5)?.every(Number.isFinite)) throw Error('Lazy morph data failed');`);
await writeFile(
  join(consumer, 'smoke.mjs'),
  `import {access} from 'node:fs/promises';\nimport {fileURLToPath} from 'node:url';\n${imports.join('\n')}`,
);
execFileSync(process.execPath, ['smoke.mjs'], { cwd: consumer, stdio: 'inherit' });
await writeFile(join(consumer, 'smoke.ts'), typeImports.join('\n'));
await writeFile(
  join(consumer, 'tsconfig.json'),
  JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      strict: true,
      skipLibCheck: false,
      noEmit: true,
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      types: ['react'],
    },
    include: ['smoke.ts'],
  }),
);
execFileSync(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '-p', consumer], {
  cwd: consumer,
  stdio: 'inherit',
});
// Check CSS-relative assets in the installed package, including bundled fonts.
for (const pkg of packages) {
  const installed = join(consumer, 'node_modules', pkg.name, 'dist');
  const { readdir } = await import('node:fs/promises');
  for (const file of (await readdir(installed)).filter((file) => file.endsWith('.css'))) {
    const css = await readFile(join(installed, file), 'utf8');
    for (const [, asset] of css.matchAll(/(?:url\(\s*|@import\s*)['"]([^'"]+)['"]/g)) {
      if (!/^(?:data:|https?:|#)/.test(asset)) await access(resolve(installed, asset));
    }
  }
}
await writeFile(
  join(destination, 'manifest.json'),
  JSON.stringify({ packages, smokeTest: 'passed' }, null, 2) + '\n',
);
console.log(
  `Verified tarballs, ESM exports, declarations, lazy geometry and CSS assets.\nArtifacts: ${destination}\nConsumer: ${consumer}\nNo packages published.`,
);
