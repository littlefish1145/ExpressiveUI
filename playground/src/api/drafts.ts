import type { Example } from './examples.js';

/** Upgrade saved Studio imports when moving from the personal npm scope. */
export function restoreDraft(canonical: Example, value: unknown): Example {
  if (!value || typeof value !== 'object') return canonical;
  const saved = value as Record<string, unknown>;
  const keys = ['html', 'ts', 'react', 'css'] as const;
  if (!keys.every((key) => typeof saved[key] === 'string')) return canonical;
  const result = { ...canonical };
  for (const key of keys)
    result[key] = (saved[key] as string).replaceAll('@amiracle1024/', '@epui/');
  if (typeof saved.cdn === 'string') result.cdn = saved.cdn.replaceAll('@amiracle1024/', '@epui/');
  return result;
}
