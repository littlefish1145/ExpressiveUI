import { bindPress } from '@epui/core';
import type { Scope } from '@epui/core';
import type { MotionScheme } from '@epui/motion';
import { decoration } from './shared.js';
import { animateStateLayer } from './state-layer.js';
import { animateColors } from './animated-styles.js';
import { bindRipple } from './ripple.js';
/** Shared effects, while native HTML remains responsible for activation. */
export function interactive(
  element: HTMLButtonElement,
  scope: Scope,
  scheme: MotionScheme = 'expressive',
) {
  const had = element.classList.contains('eui-interactive');
  element.classList.add('eui-interactive');
  const state = decoration('eui-interactive-state');
  element.prepend(state);
  const layer = animateStateLayer(element, state, scheme),
    ripple = bindRipple(element, element),
    colors = animateColors(
      element,
      [
        { element, property: 'color' },
        { element, property: 'background-color' },
        { element, property: 'border-color' },
      ],
      scheme,
    );
  scope.add(
    bindPress(element, ({ pressed }) => {
      element.dataset.pressed = String(pressed);
    }),
  );
  scope.add(() => {
    colors.destroy();
    ripple.destroy();
    layer.destroy();
    state.remove();
    if (!had) element.classList.remove('eui-interactive');
  });
  return {
    refresh: (animate = true) => colors.refresh(animate),
    configure(next: MotionScheme) {
      layer.configure(next);
      colors.configure(next);
    },
    setContour: ripple.setContour,
  };
}
