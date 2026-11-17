import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  enhanceButton,
  enhanceFab,
  enhanceSwitch,
  enhanceLoadingIndicator,
} from '@epui/components';
import { Scope, detectCapabilities, bindPress, mediaPreference } from '@epui/core';
import { activeAnimationCount } from '@epui/motion';
import { createShapeRenderer, getShape } from '@epui/shape';
afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});
describe('native controls and ownership', () => {
  it('shares media listeners while preserving separate owners of the same callback', () => {
    const media = new EventTarget() as MediaQueryList;
    Object.defineProperty(media, 'matches', { value: true });
    vi.stubGlobal('matchMedia', () => media);
    const add = vi.spyOn(media, 'addEventListener'),
      remove = vi.spyOn(media, 'removeEventListener'),
      callback = vi.fn();
    const first = mediaPreference('(test-preference)', callback),
      second = mediaPreference('(test-preference)', callback);
    expect(add).toHaveBeenCalledOnce();
    first.destroy();
    media.dispatchEvent(new Event('change'));
    expect(callback).toHaveBeenCalledOnce();
    expect(remove).not.toHaveBeenCalled();
    second.destroy();
    expect(remove).toHaveBeenCalledOnce();
  });
  it('preserves native button type and child node identity', () => {
    const form = document.createElement('form'),
      button = document.createElement('button'),
      text = document.createTextNode('Save');
    button.type = 'submit';
    button.append(text);
    form.append(button);
    document.body.append(form);
    const c = enhanceButton(button);
    expect(button.type).toBe('submit');
    expect(button.form).toBe(form);
    expect(button.textContent).toBe('Save');
    expect(button.querySelectorAll('.eui-shape')).toHaveLength(2);
    expect(button.querySelectorAll('.eui-ripple')).toHaveLength(1);
    c.destroy();
    c.destroy();
    expect(button.firstChild).toBe(text);
    expect(button.querySelectorAll('svg')).toHaveLength(0);
    expect(button.className).toBe('');
  });
  it('rejects duplicate mounting and permits remount after destruction', () => {
    const button = document.createElement('button');
    const c = enhanceButton(button);
    expect(() => enhanceButton(button)).toThrow();
    c.destroy();
    enhanceButton(button).destroy();
  });
  it('supports toggle state without generating extra click events', () => {
    const button = document.createElement('button');
    document.body.append(button);
    const onClick = vi.fn();
    button.addEventListener('click', onClick);
    const c = enhanceButton(button, { toggle: true, selected: false });
    button.click();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(onClick).toHaveBeenCalledOnce();
    c.update({ selected: false, size: 'xl', shape: 'square' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    c.destroy();
    expect(button.hasAttribute('aria-pressed')).toBe(false);
  });
  it('keeps checkbox form data, label and reset behavior', async () => {
    const form = document.createElement('form');
    form.innerHTML =
      '<label>Updates <input type="checkbox" name="updates" value="yes" checked></label>';
    document.body.append(form);
    const input = form.querySelector('input')!;
    const c = enhanceSwitch(input);
    expect(input.getAttribute('role')).toBe('switch');
    expect(new FormData(form).get('updates')).toBe('yes');
    c.setChecked(false);
    expect(new FormData(form).has('updates')).toBe(false);
    form.reset();
    await Promise.resolve();
    expect(input.checked).toBe(true);
    c.destroy();
    expect(input.hasAttribute('role')).toBe(false);
    expect(form.querySelector('.eui-switch-track')).toBe(null);
  });
  it('does not emit input/change for programmatic updates unless requested', () => {
    const label = document.createElement('label'),
      input = document.createElement('input');
    input.type = 'checkbox';
    label.append(input);
    document.body.append(label);
    const c = enhanceSwitch(input),
      change = vi.fn();
    input.addEventListener('change', change);
    c.setChecked(true);
    expect(change).not.toHaveBeenCalled();
    c.setChecked(false, { notify: true });
    expect(change).toHaveBeenCalledOnce();
    c.destroy();
  });
  it('does not activate disabled controls through keyboard press effects', () => {
    const button = document.createElement('button');
    button.disabled = true;
    const changed = vi.fn(),
      destroy = bindPress(button, changed);
    button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(changed).not.toHaveBeenCalled();
    destroy();
  });
  it('releases active animations and all decorative DOM on destroy', () => {
    const button = document.createElement('button'),
      fab = document.createElement('button'),
      loading = document.createElement('div');
    document.body.append(button, fab, loading);
    const b = enhanceButton(button),
      f = enhanceFab(fab),
      l = enhanceLoadingIndicator(loading);
    button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    fab.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(activeAnimationCount()).toBeGreaterThan(0);
    b.destroy();
    f.destroy();
    l.destroy();
    expect(activeAnimationCount()).toBe(0);
    expect(document.querySelector('.eui-shape')).toBe(null);
  });
  it('renders a static accessible loading indicator in reduced motion', () => {
    const media = new EventTarget() as MediaQueryList;
    Object.defineProperty(media, 'matches', { value: true });
    vi.stubGlobal('matchMedia', () => media);
    const div = document.createElement('div');
    const loading = enhanceLoadingIndicator(div, { label: 'Saving' });
    expect(div.getAttribute('role')).toBe('progressbar');
    expect(div.getAttribute('aria-label')).toBe('Saving');
    expect(div.querySelector('path')?.getAttribute('d')).toContain('M');
    expect(activeAnimationCount()).toBe(0);
    loading.destroy();
  });
  it('owns listener cleanup idempotently, including cleanup failures', () => {
    const scope = new Scope(),
      target = new EventTarget(),
      listener = vi.fn();
    scope.listen(target, 'test', listener);
    target.dispatchEvent(new Event('test'));
    expect(listener).toHaveBeenCalledOnce();
    scope.dispose();
    scope.dispose();
    target.dispatchEvent(new Event('test'));
    expect(listener).toHaveBeenCalledOnce();
    expect(scope.resourceCount).toBe(0);
    const bad = new Scope(),
      cleanup = vi.fn();
    bad.add(cleanup);
    bad.add(() => {
      throw Error('expected');
    });
    expect(() => bad.dispose()).toThrow(AggregateError);
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
describe('backend geometry and deterministic fallbacks (DOM emulation only)', () => {
  it.each(['svg', 'svg-clip', 'svg-mask', 'clip-path', 'css-shape'] as const)(
    'installs and disposes %s',
    (backend) => {
      const host = document.createElement('div'),
        renderer = createShapeRenderer(host, backend);
      renderer.draw(getShape('heart'));
      expect(host.childElementCount).toBeGreaterThan(0);
      renderer.destroy();
      expect(host.childElementCount).toBe(0);
      renderer.draw(getShape('circle'));
      expect(host.childElementCount).toBe(0);
    },
  );
  it('reports capability booleans without UA sniffing', () => {
    for (const value of Object.values(detectCapabilities())) expect(typeof value).toBe('boolean');
  });
});
