import { build } from 'esbuild';
import ts from 'typescript';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { transform } from 'sucrase';
await mkdir('.cache/api-examples', { recursive: true });
await build({
  entryPoints: ['playground/src/api/examples.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: '.cache/api-examples.mjs',
});
const { exampleFor } = await import(pathToFileURL(resolve('.cache/api-examples.mjs')));
const index = JSON.parse(await readFile('playground/src/api/generated/index.json', 'utf8'));
const roots = [];
let count = 0;
for (const page of index) {
  const symbols = page.package === 'adapter-react' ? page.symbols : [''];
  for (const symbol of symbols) {
    const example = exampleFor(page.id, symbol);
    for (const [source, extension, react] of [
      [example.ts, 'ts', false],
      [example.react, 'tsx', true],
    ]) {
      const path = resolve(`.cache/api-examples/${count++}.${extension}`);
      await writeFile(path, source);
      roots.push(path);
      transform(source, {
        transforms: ['typescript', ...(react ? ['jsx'] : []), 'imports'],
        jsxRuntime: 'automatic',
        production: true,
        filePath: path,
      });
    }
  }
}
const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
const program = ts.createProgram(roots, { ...parsed.options, noEmit: true });
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) {
  console.error(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (file) => file,
      getCurrentDirectory: () => process.cwd(),
      getNewLine: () => '\n',
    }),
  );
  process.exitCode = 1;
} else
  console.log(
    `Compiled and typechecked all ${roots.length} HTML/TS + React examples across ${index.length} API pages. No browser executed.`,
  );
