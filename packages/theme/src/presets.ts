import type { ThemeOptions } from './index.js';
/** Curated seed examples, not Google-defined color tokens. All roles use the official HCT engine. */
export const themePresets = [
  { id: 'iris', name: 'Iris · 鸢尾', seed: '#6750a4', variant: 'tonal-spot' },
  { id: 'jade', name: 'Jade · 翡翠', seed: '#006c4c', variant: 'tonal-spot' },
  { id: 'ocean', name: 'Ocean · 海蓝', seed: '#0061a4', variant: 'tonal-spot' },
  { id: 'rose', name: 'Rose · 玫瑰', seed: '#984061', variant: 'tonal-spot' },
  { id: 'terracotta', name: 'Terracotta · 陶土', seed: '#9c4230', variant: 'tonal-spot' },
  { id: 'amber', name: 'Amber · 琥珀', seed: '#805600', variant: 'tonal-spot' },
  { id: 'electric', name: 'Electric · 电光', seed: '#3548d6', variant: 'vibrant' },
  { id: 'graphite', name: 'Graphite · 石墨', seed: '#555b61', variant: 'monochrome' },
] as const satisfies readonly (ThemeOptions & { id: string; name: string })[];
export type ThemePresetId = (typeof themePresets)[number]['id'];
