import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const packages = ['core', 'tokens', 'shape', 'motion', 'theme', 'components', 'adapter-react'];
await mkdir('playground/public', { recursive: true });
const result = await build({
  entryPoints: ['playground/src/api/preview-runtime.ts'],
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [
    {
      name: 'preview-source',
      setup(build) {
        build.onResolve({ filter: /^@amiracle1024\// }, (args) => {
          const match = args.path.match(/^@amiracle1024\/([^/]+)(?:\/(.*))?$/);
          if (!match || !packages.includes(match[1])) return;
          return {
            path: resolve(
              `packages/${match[1]}/src/${match[2] ?? 'index'}.${match[1] === 'adapter-react' ? 'tsx' : 'ts'}`,
            ),
          };
        });
        // Keep all official pairs available without inlining 8MB of lazy data in the iframe.
        build.onLoad({ filter: /[\\/]morph-loaders\.ts$/ }, () => ({
          contents:
            'export const morphLoaders=new Proxy({}, {get:(_,key)=>()=>globalThis.__euiLoadMorph(key).then(data=>({default:data}))});',
          loader: 'js',
        }));
      },
    },
  ],
});
const code = result.outputFiles[0].contents;
const css = await build({
  entryPoints: ['packages/components/src/styles.css'],
  bundle: true,
  write: false,
  minify: true,
  outfile: 'preview.css',
  loader: { '.woff2': 'dataurl' },
});
await writeFile('playground/public/api-runtime.js', code);
await writeFile('playground/public/api-runtime.css', css.outputFiles[0].contents);
const hash = createHash('sha256')
  .update(code)
  .update(css.outputFiles[0].contents)
  .digest('hex')
  .slice(0, 16);
await mkdir('playground/src/api/generated', { recursive: true });
await writeFile('playground/src/api/generated/runtime.json', JSON.stringify({ hash }));
console.log(
  `Built isolated classic preview runtime (${code.length} B), offline CSS/fonts, and morph-data relay.`,
);
