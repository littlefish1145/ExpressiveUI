import { bindPress, observeSize } from '@amiracle1024/core';
import { iconButtonTokens } from '@amiracle1024/tokens';
import type { ButtonSize } from '@amiracle1024/tokens';
import {
  roundedRectangle,
  alignContours,
  interpolateContour,
  createShapeRenderer,
} from '@amiracle1024/shape';
import { createSpring, motionPreset } from '@amiracle1024/motion';
import type { MotionScheme } from '@amiracle1024/motion';
import { mount, decoration } from './shared.js';
import { bindRipple } from './ripple.js';
import { animateColors } from './animated-styles.js';
import { animateStateLayer } from './state-layer.js';
export interface IconButtonOptions {
  variant?: 'standard' | 'filled' | 'tonal' | 'outlined';
  size?: ButtonSize;
  width?: 'narrow' | 'uniform' | 'wide';
  shape?: 'round' | 'square';
  toggle?: boolean;
  selected?: boolean;
  motionScheme?: MotionScheme;
}
export function enhanceIconButton(element: HTMLButtonElement, initial: IconButtonOptions = {}) {
  const scope = mount(element, 'eui-button', [
    'data-variant',
    'data-size',
    'data-width',
    'data-shape',
    'data-pressed',
    'data-selected',
    'aria-pressed',
    'style',
  ]);
  const hadClass = element.classList.contains('eui-icon-button');
  element.classList.add('eui-icon-button');
  scope.add(() => {
    if (!hadClass) element.classList.remove('eui-icon-button');
  });
  let options = { ...initial },
    pressed = false,
    width = 40,
    height = 40;
  const content = document.createElement('span');
  content.className = 'eui-content';
  content.append(...element.childNodes);
  element.append(content);
  scope.add(() => content.replaceWith(...content.childNodes));
  const surface = decoration('eui-surface'),
    state = decoration('eui-state');
  element.prepend(surface, state);
  const renderer = createShapeRenderer(surface),
    overlay = createShapeRenderer(state);
  const ripple = bindRipple(element, element),
    stateLayer = animateStateLayer(element, state, options.motionScheme);
  scope.add(() => {
    ripple.destroy();
    stateLayer.destroy();
  });
  let colors: ReturnType<typeof animateColors> | undefined;
  scope.add(() => {
    renderer.destroy();
    overlay.destroy();
    surface.remove();
    state.remove();
  });
  const count = 128;
  let a = roundedRectangle(width, height, Infinity, count),
    b = roundedRectangle(width, height, 12, count),
    c = roundedRectangle(width, height, 8, count);
  const selectionOutput = new Float64Array(count * 2),
    output = new Float64Array(count * 2);
  let selectedValue = options.selected ? 1 : 0,
    pressValue = 0;
  function draw() {
    interpolateContour(a, b, selectedValue, selectionOutput);
    const points = interpolateContour(selectionOutput, c, pressValue, output);
    renderer.draw(points);
    overlay.draw(points);
    ripple.setContour(points);
  }
  const selection = createSpring(
    selectedValue,
    (value) => {
      selectedValue = value;
      draw();
    },
    motionPreset(options.motionScheme, 'default.effects'),
  );
  const pressing = createSpring(
    0,
    (value) => {
      pressValue = value;
      draw();
    },
    motionPreset(options.motionScheme, 'default.effects'),
  );
  scope.add(() => {
    selection.destroy();
    pressing.destroy();
  });
  function geometry() {
    const token = iconButtonTokens[options.size ?? 'sm'];
    if (options.variant === 'outlined') renderer.insetStroke(token.outline);
    const radius = options.shape === 'square' ? token.square : Infinity;
    const selectedRadius = options.shape === 'square' ? Infinity : token.selectedRound;
    a = roundedRectangle(width, height, radius, count);
    b = alignContours(a, roundedRectangle(width, height, selectedRadius, count), count).to;
    c = alignContours(a, roundedRectangle(width, height, token.pressed, count), count).to;
    draw();
  }
  function sync() {
    const token = iconButtonTokens[options.size ?? 'sm'];
    element.dataset.variant = options.variant ?? 'standard';
    element.dataset.size = options.size ?? 'sm';
    element.dataset.width = options.width ?? 'uniform';
    element.dataset.shape = options.shape ?? 'round';
    const variables = {
      '--_icon-height': token.height,
      '--_icon-size': token.icon,
      '--_icon-padding': token.padding[options.width ?? 'uniform'],
      '--_icon-square': token.square,
      '--_icon-outline': token.outline,
    };
    for (const [key, value] of Object.entries(variables))
      element.style.setProperty(key, `${value}px`);
    if (options.toggle) {
      element.dataset.selected = String(options.selected ?? false);
      element.setAttribute('aria-pressed', String(options.selected ?? false));
    } else {
      element.removeAttribute('data-selected');
      element.removeAttribute('aria-pressed');
    }
    selection.configure(motionPreset(options.motionScheme, 'default.effects'));
    pressing.configure(motionPreset(options.motionScheme, 'default.effects'));
    geometry();
    selection.setTarget(options.toggle && options.selected ? 1 : 0);
    pressing.setTarget(pressed ? 1 : 0);
    colors?.configure(options.motionScheme ?? 'expressive');
    colors?.refresh();
    stateLayer.configure(options.motionScheme ?? 'expressive');
  }
  sync();
  colors = animateColors(
    element,
    [
      { element, property: 'color' },
      { element: surface, property: 'color' },
    ],
    options.motionScheme,
  );
  scope.add(() => colors?.destroy());
  const size = observeSize(element, (w, h) => {
    width = w;
    height = h;
    geometry();
  });
  scope.add(() => size.destroy());
  scope.add(
    bindPress(element, (state) => {
      pressed = state.pressed;
      element.dataset.pressed = String(pressed);
      pressing.setTarget(pressed ? 1 : 0);
    }),
  );
  scope.listen(element, 'click', () => {
    if (options.toggle && !element.matches(':disabled')) {
      options.selected = !options.selected;
      sync();
    }
  });
  return {
    element,
    get selected() {
      return !!options.selected;
    },
    update(next: Partial<IconButtonOptions>) {
      if (scope.disposed) return;
      options = { ...options, ...next };
      sync();
    },
    setSelected(value: boolean) {
      if (scope.disposed) return;
      options.selected = value;
      sync();
    },
    refresh() {
      if (!scope.disposed) size.refresh();
    },
    destroy() {
      scope.dispose();
    },
  };
}
