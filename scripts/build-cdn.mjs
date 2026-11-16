import { build } from 'esbuild';
import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { transform } from 'sucrase';

const outdir = resolve('playground/public/cdn');
if (relative(resolve('playground/public'), outdir) !== 'cdn')
  throw Error('Unexpected CDN output path');
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
const names = ['core', 'tokens', 'shape', 'motion', 'theme', 'components', 'adapter-react'];
const entries = { 'expressive-ui.module': 'playground/src/cdn/entry.ts' };
await mkdir('.cache/cdn-entry', { recursive: true });
for (const [name, specifier] of Object.entries({
  react: 'react',
  'react-dom-client': 'react-dom/client',
  'react-jsx-runtime': 'react/jsx-runtime',
})) {
  const module = await import(specifier);
  const keys = Object.keys(module.default).filter(
    (key) => key !== 'default' && key !== '__esModule',
  );
  const path = `.cache/cdn-entry/${name}.js`;
  await writeFile(
    path,
    `import value from '${specifier}';\nexport default value;\nexport const {${keys.join(',')}} = value;\n`,
  );
  entries[name] = path;
}
const imports = {};
for (const name of names) {
  const pkg = JSON.parse(await readFile(`packages/${name}/package.json`, 'utf8'));
  for (const [subpath, target] of Object.entries(pkg.exports)) {
    if (typeof target === 'string') continue;
    const suffix = subpath === '.' ? '' : subpath.slice(1);
    const key = name + suffix;
    entries[key] =
      `packages/${name}/src/` +
      target.import
        .replace('./dist/', '')
        .replace(/\.js$/, name === 'adapter-react' ? '.tsx' : '.ts');
    imports[pkg.name + suffix] = `/cdn/${key}.js`;
  }
}
Object.assign(imports, {
  react: '/cdn/react.js',
  'react-dom/client': '/cdn/react-dom-client.js',
  'react/jsx-runtime': '/cdn/react-jsx-runtime.js',
});
const sourcePlugin = {
  name: 'cdn-package-source',
  setup(builder) {
    builder.onResolve({ filter: /^@amiracle1024\// }, ({ path }) => {
      const key = path.slice('@amiracle1024/'.length);
      if (entries[key]) return { path: resolve(entries[key]) };
    });
  },
};
const common = {
  bundle: true,
  minify: true,
  platform: 'browser',
  target: 'es2022',
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'linked',
};
const esm = await build({
  ...common,
  entryPoints: entries,
  outdir,
  format: 'esm',
  splitting: true,
  chunkNames: 'chunks/[name]-[hash]',
  metafile: true,
  plugins: [sourcePlugin],
});
for (const [entry, required] of Object.entries({
  react: ['createElement', 'useState'],
  'react-dom-client': ['createRoot', 'hydrateRoot'],
  'react-jsx-runtime': ['jsx', 'jsxs'],
})) {
  const output = Object.values(esm.metafile.outputs).find((file) => file.entryPoint === entries[entry]);
  if (!required.every((name) => output?.exports.includes(name)))
    throw Error(`CDN entry ${entry} is missing its named exports`);
}
// The classic script keeps all APIs but downloads official shape pairs only when used.
const morphs = {};
for (const [file, data] of Object.entries(esm.metafile.outputs)) {
  const match = data.entryPoint?.match(/morph-data\/([a-zA-Z0-9]+)-([a-zA-Z0-9]+)\.ts$/);
  if (match)
    morphs[`${match[1]}|${match[2]}`] = relative(outdir, resolve(file)).replaceAll('\\', '/');
}
if (!Object.keys(morphs).length) throw Error('CDN morph chunks are missing');
await build({
  ...common,
  entryPoints: ['playground/src/cdn/entry.ts'],
  outfile: `${outdir}/expressive-ui.js`,
  format: 'iife',
  globalName: 'ExpressiveUI',
  banner: {
    js: '/*! Expressive UI · Apache-2.0 · /cdn/LICENSE */\nvar __euiCdnBase = new URL(".", document.currentScript.src).href;',
  },
  plugins: [
    sourcePlugin,
    {
      name: 'classic-lazy-morphs',
      setup(builder) {
        builder.onLoad({ filter: /[\\/]morph-loaders\.ts$/ }, () => ({
          loader: 'js',
          contents: `const paths=${JSON.stringify(morphs)};export const morphLoaders=Object.fromEntries(Object.entries(paths).map(([key,path])=>[key,()=>import(new URL(path,__euiCdnBase).href)]));`,
        }));
      },
    },
  ],
});
await build({
  entryPoints: {
    'expressive-ui': 'packages/components/src/styles.css',
    fonts: 'packages/components/src/fonts.css',
  },
  outdir,
  bundle: true,
  minify: true,
  loader: { '.woff2': 'file' },
  assetNames: 'fonts/[name]-[hash]',
});
for (const file of ['LICENSE', 'NOTICE']) await copyFile(file, `${outdir}/${file}`);
const manifest = { imports, stylesheet: '/cdn/expressive-ui.css', script: '/cdn/expressive-ui.js' };
await writeFile(`${outdir}/import-map.json`, JSON.stringify({ imports }, null, 2) + '\n');
await mkdir('playground/src/cdn/generated', { recursive: true });
await writeFile(
  'playground/src/cdn/generated/manifest.json',
  JSON.stringify(manifest, null, 2) + '\n',
);

await mkdir('.cache', { recursive: true });
await build({
  entryPoints: {
    examples: 'playground/src/api/examples.ts',
    cdn: 'playground/src/cdn/examples.ts',
  },
  outdir: '.cache/cdn-examples',
  platform: 'node',
  format: 'esm',
  bundle: true,
  outExtension: { '.js': '.mjs' },
});
const { exampleFor } = await import(pathToFileURL(resolve('.cache/cdn-examples/examples.mjs')));
const { declarative } = await import(pathToFileURL(resolve('.cache/cdn-examples/cdn.mjs')));
const index = JSON.parse(await readFile('playground/src/api/generated/index.json', 'utf8'));
const examples = {};
for (const page of index) {
  for (const symbol of page.package === 'adapter-react' ? page.symbols : ['']) {
    const example = exampleFor(page.id, symbol);
    const html = declarative[page.id];
    let script = '';
    if (!html) {
      script = transform(example.ts, { transforms: ['typescript'], filePath: 'example.ts' })
        .code.replace(
          /import\s*\{([^}]+)\}\s*from\s*['"]@amiracle1024\/([^'"]+)['"];?/g,
          (_, specifiers, name) =>
            `const {${specifiers.replace(/\bas\b/g, ':')}} = ExpressiveUI.${name};`,
        )
        .replace(/\bexport\s+(?=(?:async\s+)?function\s)/g, '');
      if (/\bimport\s/.test(script)) throw Error('Unsupported CDN example import: ' + page.id);
      script +=
        '\nmount(document.getElementById("example")).then(cleanup => {\n  addEventListener("pagehide", cleanup, {once: true});\n}).catch(console.error);';
    }
    const css = html
      ? 'body { margin: 24px; font: 16px/1.5 var(--eui-font-family, sans-serif); background: var(--md-sys-color-surface); color: var(--md-sys-color-on-surface); }' +
        (page.id === 'components/carousel'
          ? '\n[data-carousel-item] { min-height: 200px; padding: 24px; background: var(--md-sys-color-primary-container); }'
          : '')
      : example.css;
    examples[page.id + (symbol ? ':' + symbol : '')] = {
      html: html ?? `<div id="example">${example.html}</div>`,
      css,
      script,
    };
  }
}
await writeFile(
  'playground/src/cdn/generated/examples.json',
  JSON.stringify(examples, null, 2) + '\n',
);
console.log(
  `Built CDN classic JS, ESM packages, CSS/fonts, ${Object.keys(morphs).length} lazy morphs and ${Object.keys(examples).length} Studio examples.`,
);
