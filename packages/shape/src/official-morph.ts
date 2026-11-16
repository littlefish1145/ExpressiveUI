import { loadingMorphs } from './morph-data-index.js';
export type MorphData = readonly [readonly number[], readonly number[]];
const prepared = new Map<string, MorphData>();
const pending = new Map<string, Promise<MorphData>>();
/** Optional bulk installation for applications that prepackage a known set of official pairs. */
export function registerMorphData(data: Record<string, MorphData>) {
  for (const [key, pair] of Object.entries(data)) {
    if (pair[0].length !== pair[1].length || pair[0].length % 8)
      throw new RangeError('Invalid matched cubics');
    prepared.set(key, pair);
  }
}
export function peekMorphData(key: string) {
  return prepared.get(key) ?? loadingMorphs[key];
}
export function prepareMorphData(key: string): Promise<MorphData> {
  const current = peekMorphData(key);
  if (current) return Promise.resolve(current);
  const existing = pending.get(key);
  if (existing) return existing;
  const promise = import('./morph-loaders.js')
    .then(({ morphLoaders }) => {
      const loader = morphLoaders[key];
      if (!loader) throw new TypeError('Unknown official morph pair');
      return loader();
    })
    .then(
      (module) => {
        prepared.set(key, module.default);
        if (prepared.size > 64) prepared.delete(prepared.keys().next().value!);
        pending.delete(key);
        return module.default;
      },
      (error) => {
        pending.delete(key);
        throw error;
      },
    );
  pending.set(key, promise);
  return promise;
}
