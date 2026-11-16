import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateTheme, themeToCSS, colorRoles } from '@amiracle1024/theme';
import { createThemeController } from '@amiracle1024/theme/runtime';
import { argbFromHex, Contrast, lstarFromArgb } from '@material/material-color-utilities';
afterEach(() => vi.unstubAllGlobals());
describe('official HCT dynamic colors', () => {
  it('generates all 48 roles for both modes deterministically', () => {
    const light = generateTheme({ seed: '#6750a4' }),
      dark = generateTheme({ seed: '#6750a4', dark: true });
    expect(Object.keys(light.colors)).toHaveLength(48);
    expect(light).toEqual(generateTheme({ seed: '#6750a4' }));
    expect(light.colors.primary).not.toBe(dark.colors.primary);
    expect(themeToCSS(light)).toContain('--md-sys-color-on-primary:');
  });
  it.each([
    'tonal-spot',
    'expressive',
    'vibrant',
    'neutral',
    'monochrome',
    'fidelity',
    'content',
    'rainbow',
    'fruit-salad',
  ] as const)('supports official %s variant', (variant) => {
    for (const dark of [false, true]) {
      const theme = generateTheme({ seed: '#2a7163', variant, dark });
      for (const role of colorRoles) expect(theme.colors[role]).toMatch(/^#[\da-f]{6}$/);
    }
  });
  it('increases role contrast for text with higher contrast preference', () => {
    function contrast(level: number) {
      const t = generateTheme({ seed: '#6750a4', contrast: level });
      return Contrast.ratioOfTones(
        lstarFromArgb(argbFromHex(t.colors.onSurface)),
        lstarFromArgb(argbFromHex(t.colors.surface)),
      );
    }
    expect(contrast(1)).toBeGreaterThanOrEqual(contrast(0));
  });
  it('meets text contrast on principal paired roles at normal and higher levels', () => {
    for (const dark of [false, true])
      for (const contrast of [0, 0.5, 1]) {
        const t = generateTheme({ seed: '#6750a4', dark, contrast });
        for (const [fg, bg] of [
          ['onPrimary', 'primary'],
          ['onSecondaryContainer', 'secondaryContainer'],
          ['onSurface', 'surface'],
        ] as const) {
          const ratio = Contrast.ratioOfTones(
            lstarFromArgb(argbFromHex(t.colors[fg])),
            lstarFromArgb(argbFromHex(t.colors[bg])),
          );
          expect(ratio).toBeGreaterThanOrEqual(4.5);
        }
      }
  });
  it('rejects malformed colors, selectors and contrast values', () => {
    expect(() => generateTheme({ seed: 'red' })).toThrow();
    expect(() => generateTheme({ seed: '#123456', contrast: 2 })).toThrow();
    expect(() => themeToCSS(generateTheme({ seed: '#123456' }), '}body{')).toThrow();
  });
});
describe('theme installation lifecycle', () => {
  it('rejects invalid themes before acquiring listeners or mutating the target', () => {
    const media = new EventTarget() as MediaQueryList;
    vi.stubGlobal('matchMedia', () => media);
    const add = vi.spyOn(media, 'addEventListener');
    const target = document.createElement('div');
    const malformed = { variables: { '--md-sys-color-primary': 'not-a-color' } };
    expect(() => createThemeController(target, { light: malformed, dark: malformed })).toThrow();
    expect(add).not.toHaveBeenCalled();
    expect(target.getAttribute('style')).toBe(null);
  });
  it('switches and restores variables and attributes on destruction', () => {
    const el = document.createElement('div');
    el.style.setProperty('--md-sys-color-primary', '#ffffff', 'important');
    const light = generateTheme({ seed: '#6750a4' }),
      dark = generateTheme({ seed: '#6750a4', dark: true });
    const controller = createThemeController(el, { light, dark }, 'light');
    expect(el.dataset.theme).toBe('light');
    controller.setMode('dark');
    expect(el.style.getPropertyValue('--md-sys-color-primary')).toBe(dark.colors.primary);
    controller.destroy();
    controller.destroy();
    expect(el.style.getPropertyValue('--md-sys-color-primary')).toBe('#ffffff');
    expect(el.style.getPropertyPriority('--md-sys-color-primary')).toBe('important');
    expect(el.hasAttribute('data-theme')).toBe(false);
  });
  it('follows live system dark preference and releases the listener', () => {
    const media = new EventTarget() as MediaQueryList;
    Object.defineProperty(media, 'matches', { value: false, writable: true });
    vi.stubGlobal('matchMedia', () => media);
    const remove = vi.spyOn(media, 'removeEventListener');
    const el = document.createElement('div'),
      controller = createThemeController(el, {
        light: generateTheme({ seed: '#6750a4' }),
        dark: generateTheme({ seed: '#6750a4', dark: true }),
      });
    Object.defineProperty(media, 'matches', { value: true });
    media.dispatchEvent(new Event('change'));
    expect(el.dataset.theme).toBe('dark');
    controller.destroy();
    expect(remove).toHaveBeenCalledOnce();
  });
});
