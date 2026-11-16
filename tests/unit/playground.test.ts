import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
it('mounts the real playground and supports seed, theme, backend and motion controls in DOM emulation', async () => {
  const html = readFileSync('playground/index.html', 'utf8');
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  for (const script of parsed.querySelectorAll('script')) script.remove();
  document.body.innerHTML = parsed.body.innerHTML;
  await import('../../playground/src/main.js');
  try {
    expect(document.querySelectorAll('.eui-button').length).toBeGreaterThan(15);
    expect(document.querySelectorAll('[role=switch]')).toHaveLength(4);
    expect(document.querySelectorAll('[role=progressbar]')).toHaveLength(3);
    expect(document.querySelectorAll('.eui-icon-button')).toHaveLength(8);
    expect(document.querySelectorAll('.eui-checkbox-input')).toHaveLength(4);
    expect(document.querySelectorAll('.eui-radio-input')).toHaveLength(4);
    expect(document.querySelectorAll('.eui-slider-input')).toHaveLength(8);
    expect(document.querySelectorAll('[data-preset]')).toHaveLength(8);
    const motionPreference = document.getElementById('motion-preference') as HTMLSelectElement;
    motionPreference.value = 'reduced';
    motionPreference.dispatchEvent(new Event('change'));
    expect(document.getElementById('motion-status-title')!.textContent).toContain('减少');
    motionPreference.value = 'full';
    motionPreference.dispatchEvent(new Event('change'));
    expect(document.getElementById('motion-status-title')!.textContent).toContain('完整动效');
    document.querySelector<HTMLButtonElement>('[data-preset="jade"]')!.click();
    expect(document.getElementById('seed-value')?.textContent).toBe('#006C4C');
    expect(document.querySelector('[data-preset="jade"]')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
    const seed = document.getElementById('seed') as HTMLInputElement;
    seed.value = '#006c4c';
    seed.dispatchEvent(new Event('input'));
    expect(document.getElementById('seed-value')?.textContent).toBe('#006C4C');
    const dark = document.getElementById('dark-mode') as HTMLInputElement;
    dark.checked = true;
    dark.dispatchEvent(new Event('change'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    const backend = document.getElementById('backend') as HTMLSelectElement;
    backend.value = 'svg-mask';
    backend.dispatchEvent(new Event('change'));
    expect(window.expressive.backend).toBe('svg-mask');
    const scrub = document.getElementById('scrub') as HTMLInputElement;
    scrub.value = '.5';
    scrub.dispatchEvent(new Event('input'));
    expect(window.expressive.progress).toBe(0.5);
    expect(window.expressive.shape.every(Number.isFinite)).toBe(true);
    const scheme = document.getElementById('motion-scheme') as HTMLSelectElement;
    scheme.value = 'standard';
    scheme.dispatchEvent(new Event('change'));
    expect(document.getElementById('stiffness-output')?.textContent).toBe('1400');
  } finally {
    window.expressive.destroy();
    document.body.replaceChildren();
  }
});
