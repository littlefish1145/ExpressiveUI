import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  enhanceIconButton,
  enhanceCheckbox,
  enhanceRadio,
  enhanceSlider,
  sliderMetrics,
} from '@amiracle1024/components';
import { iconButtonTokens, sliderTokens, checkboxTokens, radioTokens } from '@amiracle1024/tokens';
import { activeAnimationCount } from '@amiracle1024/motion';
import { generateTheme, themePresets } from '@amiracle1024/theme';
import { Contrast, argbFromHex, lstarFromArgb } from '@material/material-color-utilities';
const controllers: { destroy(): void }[] = [];
beforeEach(() => {
  const query = new EventTarget() as MediaQueryList;
  Object.defineProperty(query, 'matches', { value: true });
  vi.stubGlobal('matchMedia', () => query);
});
afterEach(() => {
  for (const c of controllers.splice(0)) c.destroy();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  expect(activeAnimationCount()).toBe(0);
});
function input(type: string, attributes: Record<string, string> = {}) {
  const wrapper = document.createElement('span'),
    node = document.createElement('input');
  node.type = type;
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  wrapper.append(node);
  document.body.append(wrapper);
  return node;
}
describe('source-derived control tokens', () => {
  it('contains five expressive icon button sizes and all three widths', () => {
    expect(Object.values(iconButtonTokens).map((v) => v.height)).toEqual([32, 40, 56, 96, 136]);
    expect(iconButtonTokens.sm.icon).toBe(24);
    expect(iconButtonTokens.sm.padding).toEqual({ narrow: 4, uniform: 8, wide: 14 });
    expect(iconButtonTokens.lg.padding.uniform).toBe(32);
    expect(iconButtonTokens.sm.selectedRound).toBe(12);
    expect(iconButtonTokens.sm.selectedSquare).toBe('full');
  });
  it('uses the official selection and updated slider dimensions', () => {
    expect(checkboxTokens.containerSize).toBe(18);
    expect(radioTokens.iconSize).toBe(20);
    expect(sliderTokens.handleHeight).toBe(44);
    expect(sliderTokens.activeTrackHeight).toBe(16);
    expect(sliderTokens.activeHandleLeadingSpace).toBe(6);
    expect(sliderTokens.pressedHandleWidth).toBe(2);
  });
});
describe('Icon Button', () => {
  it('preserves native semantics and toggles selection and geometry', () => {
    const button = document.createElement('button');
    button.type = 'submit';
    button.setAttribute('aria-label', 'Favorite');
    button.textContent = '★';
    document.body.append(button);
    const c = enhanceIconButton(button, { variant: 'filled', toggle: true });
    controllers.push(c);
    const original = button.querySelector('path')!.getAttribute('d');
    button.click();
    expect(c.selected).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.querySelector('path')!.getAttribute('d')).not.toBe(original);
    expect(button.type).toBe('submit');
    expect(button.getAttribute('aria-label')).toBe('Favorite');
  });
  it('makes momentary icon buttons stay momentary and respects disabled', () => {
    const button = document.createElement('button'),
      c = enhanceIconButton(button);
    controllers.push(c);
    button.click();
    expect(button.hasAttribute('aria-pressed')).toBe(false);
    c.update({ toggle: true, selected: false });
    button.disabled = true;
    button.click();
    expect(c.selected).toBe(false);
  });
  it('restores attributes, inline styles and original nodes on destruction', () => {
    const button = document.createElement('button'),
      text = document.createTextNode('Play');
    button.append(text);
    button.style.color = 'red';
    button.dataset.size = 'custom';
    const c = enhanceIconButton(button, { size: 'lg', width: 'wide', shape: 'square' });
    expect(button.style.getPropertyValue('--_icon-padding')).toBe('48px');
    c.destroy();
    expect(button.firstChild).toBe(text);
    expect(button.style.color).toBe('red');
    expect(button.style.getPropertyValue('--_icon-padding')).toBe('');
    expect(button.dataset.size).toBe('custom');
    expect(button.classList.contains('eui-icon-button')).toBe(false);
  });
  it('press shape takes priority over selected shape and returns to selection', () => {
    const button = document.createElement('button'),
      c = enhanceIconButton(button, { toggle: true, selected: true });
    controllers.push(c);
    const selected = button.querySelector('path')!.getAttribute('d');
    button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    const pressed = button.querySelector('path')!.getAttribute('d');
    expect(pressed).not.toBe(selected);
    button.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }));
    expect(button.querySelector('path')!.getAttribute('d')).toBe(selected);
  });
});
describe('Checkbox native and mixed states', () => {
  it('moves between mixed, checked and unchecked without duplicate ARIA state', () => {
    const node = input('checkbox'),
      c = enhanceCheckbox(node);
    controllers.push(c);
    c.setState('mixed');
    expect(node.indeterminate).toBe(true);
    expect(node.checked).toBe(false);
    expect(c.state).toBe('mixed');
    expect(node.hasAttribute('aria-checked')).toBe(false);
    expect(node.parentElement!.querySelector('path')!.getAttribute('d')).toContain(
      'L9.0000 9.0000',
    );
    node.click();
    expect(node.indeterminate).toBe(false);
    expect(node.checked).toBe(true);
    c.setState('unchecked');
    expect(c.state).toBe('unchecked');
  });
  it('keeps form values, required validation and cancellation native', () => {
    const form = document.createElement('form'),
      node = input('checkbox', { name: 'consent', value: 'yes', required: '' });
    form.append(node.parentElement!);
    document.body.append(form);
    const c = enhanceCheckbox(node);
    controllers.push(c);
    expect(node.checkValidity()).toBe(false);
    c.setState('checked');
    expect(node.checkValidity()).toBe(true);
    expect(new FormData(form).get('consent')).toBe('yes');
    node.addEventListener('click', (event) => event.preventDefault());
    node.click();
    expect(node.checked).toBe(true);
  });
  it('handles defaultChecked reset and does not invent a change event', async () => {
    const form = document.createElement('form'),
      node = input('checkbox', { checked: '' });
    form.append(node.parentElement!);
    document.body.append(form);
    const c = enhanceCheckbox(node),
      change = vi.fn();
    controllers.push(c);
    node.addEventListener('change', change);
    c.setState('unchecked');
    expect(change).not.toHaveBeenCalled();
    form.reset();
    await Promise.resolve();
    expect(c.state).toBe('checked');
    expect(
      node.parentElement!.querySelector('.eui-checkbox-mark')?.getAttribute('stroke-dashoffset'),
    ).toBe('0');
  });
  it('emits requested programmatic notifications exactly once', () => {
    const node = input('checkbox'),
      c = enhanceCheckbox(node),
      changed = vi.fn(),
      entered = vi.fn();
    controllers.push(c);
    node.addEventListener('change', changed);
    node.addEventListener('input', entered);
    c.setState('checked', { notify: true });
    c.setState('checked', { notify: true });
    expect(changed).toHaveBeenCalledOnce();
    expect(entered).toHaveBeenCalledOnce();
  });
  it('supports error state while preserving original aria-invalid on destroy', () => {
    const node = input('checkbox', { 'aria-invalid': 'false' }),
      c = enhanceCheckbox(node, { error: true });
    expect(node.getAttribute('aria-invalid')).toBe('true');
    c.update({ error: false });
    expect(node.hasAttribute('aria-invalid')).toBe(false);
    c.destroy();
    expect(node.getAttribute('aria-invalid')).toBe('false');
  });
  it('does not synthesize activation over a disabled native checkbox', () => {
    const node = input('checkbox');
    node.disabled = true;
    controllers.push(enhanceCheckbox(node));
    node.click();
    expect(node.checked).toBe(false);
  });
});
describe('Radio group ownership', () => {
  it('updates the deselected sibling even though native radio only emits change on the new selection', () => {
    const first = input('radio', { name: 'color', checked: '' }),
      second = input('radio', { name: 'color' });
    const a = enhanceRadio(first),
      b = enhanceRadio(second);
    controllers.push(a, b);
    second.click();
    expect(second.checked).toBe(true);
    expect(first.checked).toBe(false);
    expect(first.parentElement!.querySelector('.eui-radio-dot')?.getAttribute('r')).toBe('0');
    expect(second.parentElement!.querySelector('.eui-radio-dot')?.getAttribute('r')).toBe('5');
  });
  it('does not link same-name radios owned by different forms', () => {
    const formA = document.createElement('form'),
      formB = document.createElement('form'),
      a = input('radio', { name: 'mode', checked: '' }),
      b = input('radio', { name: 'mode' });
    formA.append(a.parentElement!);
    formB.append(b.parentElement!);
    document.body.append(formA, formB);
    controllers.push(enhanceRadio(a), enhanceRadio(b));
    b.click();
    expect(a.checked).toBe(true);
    expect(b.checked).toBe(true);
  });
  it('preserves group form data and programmatic mutual exclusion', () => {
    const form = document.createElement('form'),
      a = input('radio', { name: 'mode', value: 'a', checked: '' }),
      b = input('radio', { name: 'mode', value: 'b' });
    form.append(a.parentElement!, b.parentElement!);
    document.body.append(form);
    const first = enhanceRadio(a),
      second = enhanceRadio(b);
    controllers.push(first, second);
    second.setChecked(true);
    expect(a.checked).toBe(false);
    expect(new FormData(form).get('mode')).toBe('b');
  });
  it('cleans decoration and ignores post-destroy updates', () => {
    const node = input('radio'),
      c = enhanceRadio(node);
    c.destroy();
    c.setChecked(true);
    expect(node.checked).toBe(false);
    expect(node.parentElement!.querySelector('svg')).toBe(null);
  });
});
describe('Slider behavior and geometry', () => {
  function slider(attributes: Record<string, string> = {}) {
    const node = input('range', { min: '0', max: '100', step: 'any', value: '50', ...attributes }),
      c = enhanceSlider(node);
    controllers.push(c);
    return { node, c };
  }
  function key(node: HTMLInputElement, key: string, type = 'keydown') {
    const event = new KeyboardEvent(type, { key, bubbles: true, cancelable: true });
    node.dispatchEvent(event);
    return event;
  }
  it('preserves min/max, name, value and native range type', () => {
    const { node, c } = slider({ name: 'volume' });
    c.setValue(80);
    expect(node.type).toBe('range');
    expect(node.name).toBe('volume');
    expect(sliderMetrics(node)).toMatchObject({
      min: 0,
      max: 100,
      value: 80,
      fraction: 0.8,
      step: null,
    });
  });
  it('uses a 1% continuous keyboard delta plus Home, End and Page increments', () => {
    const { node } = slider({ max: '200', value: '100' });
    key(node, 'ArrowRight');
    expect(node.valueAsNumber).toBe(102);
    key(node, 'PageUp');
    expect(node.valueAsNumber).toBe(122);
    key(node, 'PageDown');
    expect(node.valueAsNumber).toBe(102);
    key(node, 'Home');
    expect(node.valueAsNumber).toBe(0);
    key(node, 'End');
    expect(node.valueAsNumber).toBe(200);
  });
  it('reverses horizontal arrows in RTL but not Home/End or Page semantics', () => {
    const { node, c } = slider();
    node.parentElement!.style.direction = 'rtl';
    c.refresh();
    key(node, 'ArrowRight');
    expect(node.valueAsNumber).toBe(49);
    key(node, 'ArrowLeft');
    expect(node.valueAsNumber).toBe(50);
    key(node, 'PageUp');
    expect(node.valueAsNumber).toBe(60);
    key(node, 'Home');
    expect(node.valueAsNumber).toBe(0);
  });
  it('uses discrete allowed values and emits change only on keyboard completion', () => {
    const { node } = slider({ step: '20', value: '40' }),
      entered = vi.fn(),
      changed = vi.fn();
    node.addEventListener('input', entered);
    node.addEventListener('change', changed);
    const event = key(node, 'ArrowRight');
    expect(event.defaultPrevented).toBe(true);
    expect(node.valueAsNumber).toBe(60);
    expect(entered).toHaveBeenCalledOnce();
    expect(changed).not.toHaveBeenCalled();
    key(node, 'ArrowRight', 'keyup');
    expect(changed).toHaveBeenCalledOnce();
  });
  it('does not emit events or consume Tab at bounds or while disabled', () => {
    const { node } = slider({ value: '100' }),
      entered = vi.fn();
    node.addEventListener('input', entered);
    key(node, 'ArrowRight');
    expect(entered).not.toHaveBeenCalled();
    expect(key(node, 'Tab').defaultPrevented).toBe(false);
    node.disabled = true;
    expect(key(node, 'ArrowLeft').defaultPrevented).toBe(false);
    expect(node.valueAsNumber).toBe(100);
  });
  it('keeps tick nodes stable during input and limits pathological tick counts', () => {
    const { node, c } = slider({ step: '.001' });
    const ticks = node.parentElement!.querySelectorAll('.eui-slider-ticks circle');
    expect(ticks.length).toBeLessThanOrEqual(200);
    expect(ticks.length).toBeGreaterThan(0);
    c.setValue(75);
    expect(node.parentElement!.querySelector('.eui-slider-ticks circle')).toBe(ticks[0]);
  });
  it('exposes formatted values without adding duplicate aria-valuenow', () => {
    const { node, c } = slider();
    c.update({ formatValue: (v) => `${v}%`, showValue: 'always' });
    expect(node.getAttribute('aria-valuetext')).toBe('50%');
    expect(node.hasAttribute('aria-valuenow')).toBe(false);
    expect(node.parentElement!.querySelector('.eui-slider-value')?.textContent).toBe('50%');
  });
  it('keeps the 44px handle and narrows it on focus', () => {
    const { node } = slider();
    const handle = node.parentElement!.querySelector<HTMLElement>('.eui-slider-handle')!;
    node.focus();
    expect(handle.style.getPropertyValue('--_eui-handle-scale')).toBe('0.5');
    node.blur();
    expect(handle.style.getPropertyValue('--_eui-handle-scale')).toBe('1');
  });
  it('synchronizes after form reset and restores value text on destroy', async () => {
    const { node, c } = slider({ 'aria-valuetext': 'Original' });
    const form = document.createElement('form');
    form.append(node.parentElement!);
    document.body.append(form);
    c.setValue(90);
    form.reset();
    await Promise.resolve();
    expect(c.value).toBe(50);
    c.update({ formatValue: (v) => `${v} units` });
    c.destroy();
    expect(node.getAttribute('aria-valuetext')).toBe('Original');
    expect(node.parentElement!.querySelector('.eui-slider-visual')).toBe(null);
  });
  it('rejects non-range elements and non-finite values', () => {
    expect(() => enhanceSlider(input('text'))).toThrow();
    const { c } = slider();
    expect(() => c.setValue(NaN)).toThrow();
  });
});
describe('additional official-HCT themes', () => {
  it('offers eight distinct seeds, with valid light/dark role contrast', () => {
    expect(themePresets).toHaveLength(8);
    expect(new Set(themePresets.map((p) => p.seed)).size).toBe(8);
    for (const preset of themePresets)
      for (const dark of [false, true]) {
        const theme = generateTheme({ seed: preset.seed, variant: preset.variant, dark });
        for (const [fg, bg] of [
          ['onPrimary', 'primary'],
          ['onSurface', 'surface'],
          ['onSecondaryContainer', 'secondaryContainer'],
        ] as const) {
          const ratio = Contrast.ratioOfTones(
            lstarFromArgb(argbFromHex(theme.colors[fg])),
            lstarFromArgb(argbFromHex(theme.colors[bg])),
          );
          expect(ratio).toBeGreaterThanOrEqual(4.5);
        }
      }
  });
});
