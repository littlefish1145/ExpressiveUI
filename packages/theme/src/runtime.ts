import { mediaPreference } from '@amiracle1024/core';
export type ThemeMode = 'light' | 'dark' | 'system';
export interface ThemeVariables {
  readonly variables: Readonly<Record<string, string>>;
}
export interface ThemePair {
  light: ThemeVariables;
  dark: ThemeVariables;
}
function validateThemes(pair: ThemePair) {
  for (const theme of [pair.light, pair.dark])
    for (const [key, value] of Object.entries(theme.variables))
      if (!/^--md-sys-color-[a-z-]+$/.test(key) || !/^#[\da-f]{6}$/i.test(value))
        throw new TypeError('Invalid generated theme variable');
}
/** Lightweight runtime: no color computation and no MCU import. */
export function createThemeController(
  target: HTMLElement,
  initial: ThemePair,
  mode: ThemeMode = 'system',
) {
  validateThemes(initial);
  if (!['light', 'dark', 'system'].includes(mode)) throw new TypeError('Invalid theme mode');
  let themes = initial;
  let current = mode;
  let disposed = false;
  const saved = new Map<string, { value: string; priority: string }>();
  const originalAttribute = target.getAttribute('data-theme');
  const remember = (key: string) => {
    if (!saved.has(key))
      saved.set(key, {
        value: target.style.getPropertyValue(key),
        priority: target.style.getPropertyPriority(key),
      });
  };
  const media = mediaPreference('(prefers-color-scheme: dark)', () => apply());
  function apply() {
    if (disposed) return;
    const dark = current === 'dark' || (current === 'system' && media.matches);
    const next = themes[dark ? 'dark' : 'light'].variables;
    for (const key of saved.keys())
      if (key.startsWith('--md-sys-color-') && !(key in next)) {
        const old = saved.get(key)!;
        if (old.value) target.style.setProperty(key, old.value, old.priority);
        else target.style.removeProperty(key);
      }
    for (const [key, value] of Object.entries(next)) {
      remember(key);
      target.style.setProperty(key, value);
    }
    remember('color-scheme');
    target.style.colorScheme = dark ? 'dark' : 'light';
    target.dataset.theme = dark ? 'dark' : 'light';
  }
  apply();
  return {
    get mode() {
      return current;
    },
    setMode(next: ThemeMode) {
      if (disposed) return;
      if (!['light', 'dark', 'system'].includes(next)) throw new TypeError('Invalid theme mode');
      current = next;
      apply();
    },
    setThemes(next: ThemePair) {
      if (disposed) return;
      validateThemes(next);
      themes = next;
      apply();
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      media.destroy();
      for (const [key, old] of saved)
        if (old.value) target.style.setProperty(key, old.value, old.priority);
        else target.style.removeProperty(key);
      if (originalAttribute === null) target.removeAttribute('data-theme');
      else target.setAttribute('data-theme', originalAttribute);
    },
  };
}
