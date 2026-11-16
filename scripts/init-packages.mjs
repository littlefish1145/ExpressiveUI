import { mkdir, writeFile } from 'node:fs/promises';
const graph = {
  core: [],
  tokens: [],
  shape: ['core'],
  motion: ['core', 'tokens'],
  theme: ['core'],
  components: ['core', 'tokens', 'shape', 'motion'],
  'adapter-react': ['components'],
};
for (const [name, deps] of Object.entries(graph)) {
  await mkdir(`packages/${name}/src`, { recursive: true });
  const entry = name === 'adapter-react' ? 'index.tsx' : 'index.ts';
  const exports = { '.': { types: './dist/index.d.ts', import: './dist/index.js' } };
  if (name === 'theme')
    exports['./runtime'] = { types: './dist/runtime.d.ts', import: './dist/runtime.js' };
  if (name === 'components' || name === 'tokens') exports['./styles.css'] = './dist/styles.css';
  if (name === 'shape')
    exports['./geometry'] = { types: './dist/geometry.d.ts', import: './dist/geometry.js' };
  const p = {
    name: `@expressive-ui/${name}`,
    version: '0.1.0',
    description: `Material 3 Expressive ${name} for the Web`,
    type: 'module',
    license: 'Apache-2.0',
    sideEffects: name === 'components' || name === 'tokens' ? ['**/*.css'] : false,
    files: ['dist', 'README.md', 'LICENSE', 'NOTICE'],
    main: './dist/index.js',
    types: './dist/index.d.ts',
    exports,
    publishConfig: { access: 'public' },
    dependencies: Object.fromEntries(deps.map((d) => [`@expressive-ui/${d}`, '^0.1.0'])),
  };
  if (name === 'theme') p.dependencies['@material/material-color-utilities'] = '0.3.0';
  if (name === 'adapter-react') p.peerDependencies = { react: '>=18' };
  await writeFile(`packages/${name}/package.json`, JSON.stringify(p, null, 2) + '\n');
  await writeFile(
    `packages/${name}/tsconfig.build.json`,
    JSON.stringify(
      {
        extends: '../../tsconfig.json',
        compilerOptions: {
          declaration: true,
          emitDeclarationOnly: true,
          outDir: 'dist',
          rootDir: 'src',
          paths: {},
        },
        include: [`src/**/*.ts`, `src/**/*.tsx`],
      },
      null,
      2,
    ) + '\n',
  );
  await writeFile(
    `packages/${name}/README.md`,
    `# @expressive-ui/${name}\n\nSee the workspace README and docs/api.md. ESM, Apache-2.0.\n`,
  );
}
console.log('Initialized 7 packages with acyclic dependencies.');
