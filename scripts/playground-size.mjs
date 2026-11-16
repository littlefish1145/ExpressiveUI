import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
const root = 'dist/playground/';
const manifest = JSON.parse(await readFile(root + '.vite/manifest.json', 'utf8'));
const entry = Object.entries(manifest).find(
  ([key, item]) => key === 'index.html' && item.isEntry && item.file.endsWith('.js'),
);
if (!entry) throw Error('Missing playground entry');
const initial = new Set(),
  lazy = new Set();
function visit(key, set, followDynamic = false) {
  if (set.has(key)) return;
  set.add(key);
  const item = manifest[key];
  if (!item) throw Error('Missing manifest key ' + key);
  for (const key of item.imports ?? []) visit(key, set, followDynamic);
  if (followDynamic) for (const key of item.dynamicImports ?? []) visit(key, set, true);
}
visit(entry[0], initial);
visit(entry[0], lazy, true);
const initialFiles = new Set();
for (const key of initial) {
  const item = manifest[key];
  initialFiles.add(item.file);
  for (const file of item.css ?? []) initialFiles.add(file);
}
const rows = [];
for (const file of initialFiles) {
  const data = await readFile(root + file);
  rows.push({
    file,
    bytes: data.length,
    gzip: gzipSync(data, { level: 9 }).length,
    gzipLevel6: gzipSync(data, { level: 6 }).length,
  });
}
const html = await readFile(root + 'index.html');
const total = rows.reduce((sum, row) => sum + row.bytes, 0),
  gzip = rows.reduce((sum, row) => sum + row.gzip, 0);
const summary = {
  rows,
  initialJSBytes: rows
    .filter((row) => row.file.endsWith('.js'))
    .reduce((sum, row) => sum + row.bytes, 0),
  initialJSGzip: rows
    .filter((row) => row.file.endsWith('.js'))
    .reduce((sum, row) => sum + row.gzip, 0),
  initialJSGzipLevel6: rows
    .filter((row) => row.file.endsWith('.js'))
    .reduce((sum, row) => sum + row.gzipLevel6, 0),
  initialBytes: total,
  initialGzip: gzip,
  htmlBytes: html.length,
  htmlGzip: gzipSync(html, { level: 9 }).length,
  lazyChunks: [...lazy].filter((key) => !initial.has(key)).length,
};
await writeFile('docs/playground-size.json', JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
