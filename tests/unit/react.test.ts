import { it, expect, vi } from 'vitest';
import { createElement, act, StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Button,
  IconButton,
  Checkbox,
  Radio,
  Slider,
} from '../../packages/adapter-react/src/index.js';
import { activeAnimationCount } from '@epui/motion';
it('reconciles native content, controlled choices and slider keyboard updates under StrictMode', async () => {
  const query = new EventTarget() as MediaQueryList;
  Object.defineProperty(query, 'matches', { value: true });
  vi.stubGlobal('matchMedia', () => query);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  function Demo() {
    const [value, setValue] = useState(40),
      [checked, setChecked] = useState(false),
      [label, setLabel] = useState('Save');
    return createElement(
      'div',
      null,
      createElement(Button, { onClick: () => setLabel('Saved') }, label),
      createElement(IconButton, { 'aria-label': 'Favorite', options: { toggle: true } }, '★'),
      createElement(Checkbox, {
        'aria-label': 'Choice',
        checked,
        onChange: (e) => setChecked(e.currentTarget.checked),
      }),
      createElement(Radio, { 'aria-label': 'Mode', name: 'mode', defaultChecked: true }),
      createElement(Slider, {
        'aria-label': 'Volume',
        min: 0,
        max: 100,
        step: 20,
        value,
        onChange: (e) => setValue(Number(e.currentTarget.value)),
      }),
      createElement('output', { 'data-current-value': '' }, String(value)),
    );
  }
  try {
    await act(async () => {
      root.render(createElement(StrictMode, null, createElement(Demo)));
    });
    expect(host.querySelectorAll('.eui-icon-button')).toHaveLength(1);
    expect(host.querySelectorAll('.eui-checkbox-visual')).toHaveLength(1);
    await act(async () => {
      host.querySelector('button')!.click();
    });
    expect(host.querySelector('button')!.textContent).toBe('Saved');
    const checkbox = host.querySelector<HTMLInputElement>('input[type=checkbox]')!;
    await act(async () => {
      checkbox.click();
    });
    expect(checkbox.checked).toBe(true);
    const slider = host.querySelector<HTMLInputElement>('input[type=range]')!;
    await act(async () => {
      slider.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
      );
      slider.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));
    });
    expect(slider.valueAsNumber).toBe(60);
    expect(host.querySelector('[data-current-value]')!.textContent).toBe('60');
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
  expect(activeAnimationCount()).toBe(0);
});
