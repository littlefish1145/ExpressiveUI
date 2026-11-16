import type { Scope } from '@amiracle1024/core';
import { decoration } from './shared.js';
import { svgElement } from './svg.js';
export { svgElement } from './svg.js';
import { bindRipple } from './ripple.js';
import { animateStateLayer } from './state-layer.js';
export function choiceDecoration(
  input: HTMLInputElement,
  scope: Scope,
  kind: 'checkbox' | 'radio',
) {
  if (!input.parentElement) throw new TypeError('Selection control requires a dedicated wrapper');
  const host = input.parentElement,
    hadClass = host.classList.contains('eui-choice');
  host.classList.add('eui-choice');
  const visual = decoration(`eui-choice-visual eui-${kind}-visual`);
  const state = decoration('eui-choice-state');
  visual.append(state);
  const svg = svgElement('svg', {
    viewBox: `0 0 ${kind === 'checkbox' ? 18 : 20} ${kind === 'checkbox' ? 18 : 20}`,
    'aria-hidden': 'true',
    focusable: 'false',
  });
  visual.append(svg);
  input.after(visual);
  const ripple = bindRipple(input, visual, { bounded: false, radius: 20 }),
    stateLayer = animateStateLayer(input, state);
  scope.add(() => {
    ripple.destroy();
    stateLayer.destroy();
  });
  scope.add(() => {
    visual.remove();
    if (!hadClass) host.classList.remove('eui-choice');
  });
  return { host, visual, svg };
}
export function observeChoice(
  input: HTMLInputElement,
  scope: Scope,
  refresh: (animate?: boolean) => void,
) {
  scope.listen(input, 'change', () => {
    refresh();
    queueMicrotask(() => {
      if (!scope.disposed) refresh();
    });
  });
  if (input.form)
    scope.listen(input.form, 'reset', (event) => {
      queueMicrotask(() => {
        if (!scope.disposed && !event.defaultPrevented) refresh(false);
      });
    });
  const observer = new MutationObserver(() => refresh());
  observer.observe(input, {
    attributes: true,
    attributeFilter: ['checked', 'disabled', 'aria-invalid', 'name'],
  });
  let ancestor = input.parentElement;
  while (ancestor) {
    if (ancestor.tagName === 'FIELDSET')
      observer.observe(ancestor, { attributes: true, attributeFilter: ['disabled'] });
    ancestor = ancestor.parentElement;
  }
  scope.add(() => observer.disconnect());
}
export function notifyChange(input: HTMLInputElement) {
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
