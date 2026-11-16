import { resolve, dirname } from 'node:path';
import { gzipSync } from 'node:zlib';
export function bundleMetrics(result, entry) {
  const meta = new Map(
    Object.entries(result.metafile.outputs).map(([name, info]) => [resolve(name), info]),
  );
  const files = new Map(result.outputFiles.map((file) => [resolve(file.path), file.contents]));
  const root = [...meta].find(
    ([_key, info]) => info.entryPoint && resolve(info.entryPoint) === resolve(entry),
  );
  if (!root) throw Error('Missing bundle entry metadata: ' + entry);
  const initial = new Set();
  function visit(key) {
    if (initial.has(key)) return;
    initial.add(key);
    for (const item of meta.get(key)?.imports ?? []) {
      if (item.external || item.kind === 'dynamic-import') continue;
      const direct = resolve(item.path);
      visit(meta.has(direct) ? direct : resolve(dirname(key), item.path));
    }
  }
  visit(root[0]);
  let bytes = 0,
    gzip = 0;
  for (const key of initial) {
    const output = files.get(key);
    if (!output) throw Error('Missing bundle chunk: ' + key);
    bytes += output.length;
    gzip += gzipSync(output, { level: 9 }).length;
  }
  return {
    bundleBytes: bytes,
    gzipBytes: gzip,
    lazyChunks: result.outputFiles.length - initial.size,
    totalEmittedBytes: result.outputFiles.reduce((sum, f) => sum + f.contents.length, 0),
  };
}
