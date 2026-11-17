import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { bundleMetrics } from './bundle-metrics.mjs';
const targets = [
  ['core', 'packages/core/dist/index.js', 6],
  ['shape', 'packages/shape/dist/index.js', 8],
  ['shape/geometry', 'packages/shape/dist/geometry.js', 8],
  ['shape/renderer', 'packages/shape/dist/renderer.js', 8],
  ['motion', 'packages/motion/dist/index.js', 5],
  ['theme/runtime', 'packages/theme/dist/runtime.js', 4],
  ['theme/HCT', 'packages/theme/dist/index.js', null],
  ['components', 'packages/components/dist/index.js', null],
];
const rows = [];
for (const [name, entry, budget] of targets) {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    minify: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    metafile: true,
    splitting: true,
    outdir: `.cache/size-${name.replace('/', '-')}`,
  });
  const metrics = bundleMetrics(result, entry);
  const root = entry.slice(0, entry.indexOf('/dist')) + '/dist';
  let esm = 0;
  for (const file of await readdir(root, { recursive: true }))
    if (file.endsWith('.js')) esm += (await readFile(`${root}/${file}`)).length;
  rows.push({
    package: name,
    esmBytes: esm,
    ...metrics,
    budgetBytes: budget ? budget * 1024 : null,
  });
}
const probes = {
  'core capability only':
    'import {detectCapabilities} from "@epui/core"; console.log(detectCapabilities());',
  'motion solver only':
    'import {solveSpring} from "@epui/motion"; console.log(solveSpring(0,1,0,.1,{stiffness:380,dampingRatio:.8}));',
  'shape numeric geometry only':
    'import {interpolateContour} from "@epui/shape/geometry"; console.log(interpolateContour(new Float64Array(8),new Float64Array(8),.5));',
  'one button only':
    'import {enhanceButton} from "@epui/components"; enhanceButton(document.querySelector("button"));',
};
const shaking = [];
for (const [name, contents] of Object.entries(probes)) {
  const result = await build({
    stdin: { contents, resolveDir: process.cwd() },
    bundle: true,
    write: false,
    minify: true,
    format: 'esm',
    platform: 'browser',
    metafile: true,
  });
  const bytes = result.outputFiles[0].contents;
  shaking.push({
    name,
    bytes: bytes.length,
    gzip: gzipSync(bytes, { level: 9 }).length,
    includesHCT: Object.entries(result.metafile.inputs).some(
      ([name, info]) => name.includes('hct') && info.bytes > 0,
    ),
    includesShapeLibrary: result.outputFiles[0].text.includes('cookie9Sided'),
  });
}
const cssResult = await build({
  entryPoints: ['packages/components/dist/styles.css'],
  bundle: true,
  minify: true,
  write: false,
  outdir: '.cache/size-css',
  loader: { '.woff2': 'file' },
  metafile: true,
});
const css = Object.entries(cssResult.metafile.inputs)
  .filter(([name]) => name.endsWith('.css'))
  .reduce((sum, [, input]) => sum + input.bytes, 0);
const cssGzip = gzipSync(
  cssResult.outputFiles.find((file) => file.path.endsWith('.css')).contents,
  { level: 9 },
).length;
const fontBytes = cssResult.outputFiles
  .filter((file) => file.path.endsWith('.woff2'))
  .reduce((sum, file) => sum + file.contents.length, 0);
const table = [
  '| Package | ESM source¹ | Minified bundle² | Gzip | Budget |',
  '|---|---:|---:|---:|---|',
  ...rows.map(
    (r) =>
      `| ${r.package} | ${r.esmBytes} B | ${r.bundleBytes} B | ${r.gzipBytes} B | ${r.budgetBytes ? (r.gzipBytes <= r.budgetBytes ? 'PASS' : 'OVER') + ' / ' + r.budgetBytes + ' B' : '—'} |`,
  ),
];
const report =
  '# 包体积报告\n\n由 `npm run size` 自动生成。单位为字节，gzip level 9；当前工具版本见 package-lock.json。预算为优化目标。\n\n' +
  table.join('\n') +
  '\n\n¹ 包内 .js 总和（不含 map、类型和 CSS）。² 浏览器打包并 minify，含传递依赖；不可将重叠包简单相加。\n\nComponents CSS 源码 ' +
  css +
  ' B；合并压缩后 gzip ' +
  cssGzip +
  ' B（单独计费，不隐藏 CSS 成本）。\n\n| Tree shaking probe | Minified | Gzip | HCT | Full polygon library |\n|---|---:|---:|---|---|\n' +
  shaking
    .map(
      (r) =>
        `| ${r.name} | ${r.bytes} B | ${r.gzip} B | ${r.includesHCT ? 'yes' : 'no'} | ${r.includesShapeLibrary ? 'yes' : 'no'} |`,
    )
    .join('\n') +
  '\n\n表中bundle/gzip包含入口及其静态共享依赖，按需加载的官方形变数据及加载索引另列。预算作优化目标，不删减官方几何精度来达标。\n\n| Package | Lazy chunks | All emitted JS |\n|---|---:|---:|\n' +
  rows.map((r) => `| ${r.package} | ${r.lazyChunks} | ${r.totalEmittedBytes} B |`).join('\n') +
  '\n\nRoboto variable WOFF2（Latin + extended，按unicode-range加载）：' +
  fontBytes +
  ' B，独立缓存，未混入JS/CSS gzip。完整1190组官方匹配均可按需加载；Loading Indicator的七组匹配为静态依赖。\n';
await writeFile('docs/bundle-size.md', report);
await writeFile(
  'docs/bundle-size.json',
  JSON.stringify({ rows, shaking, cssBytes: css, cssGzip, fontBytes }, null, 2) + '\n',
);
console.log(report);
if (shaking.find((x) => x.name === 'one button only')?.includesHCT)
  throw Error('Button unexpectedly bundles HCT');
if (shaking.find((x) => x.name === 'one button only')?.includesShapeLibrary)
  throw Error('Button unexpectedly bundles Polygon library');
