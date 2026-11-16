import { bindPress, observeSize } from '@amiracle1024/core';
import { buttonTokens } from '@amiracle1024/tokens';
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
import { bindElevation } from './elevation.js';
export type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text' | 'elevated';
export interface ButtonOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: 'round' | 'square';
  toggle?: boolean;
  selected?: boolean;
  motionScheme?: MotionScheme;
}
export function enhanceButton(element: HTMLButtonElement, initial: ButtonOptions = {}) {
  const scope = mount(element, 'eui-button', [
    'data-variant',
    'data-size',
    'data-shape',
    'data-pressed',
    'data-selected',
    'aria-pressed',
  ]);
  let options = { ...initial };
  let width = 100,
    height = 40;
  let pair = alignContours(
    roundedRectangle(width, height, Infinity),
    roundedRectangle(width, height, 8),
  );
  const output = new Float64Array(pair.from.length);
  const content = document.createElement('span');
  content.className = 'eui-content';
  content.append(...element.childNodes);
  element.append(content);
  scope.add(() => content.replaceWith(...content.childNodes));
  const surface = decoration('eui-surface'),
    state = decoration('eui-state');
  element.prepend(surface, state);
  // SVG keeps a real transparent stroke for outlined buttons on arbitrary backdrops.
  const renderer = createShapeRenderer(surface, 'svg');
  const overlay = createShapeRenderer(state, 'svg');
  const ripple = bindRipple(element, element),
    stateLayer = animateStateLayer(element, state, options.motionScheme);
  scope.add(() => {
    ripple.destroy();
    stateLayer.destroy();
  });
  let colors: ReturnType<typeof animateColors> | undefined;
  const elevation = bindElevation(
    element,
    options.variant === 'elevated' ? 1 : 0,
    options.variant === 'elevated' ? 2 : 0,
    options.motionScheme,
  );
  scope.add(() => elevation.destroy());
  let baseRadius = 20,
    pressedRadius = 8;
  scope.add(() => {
    renderer.destroy();
    overlay.destroy();
    surface.remove();
    state.remove();
  });
  function draw(progress: number) {
    const points = interpolateContour(pair.from, pair.to, progress, output);
    renderer.draw(points);
    overlay.draw(points);
    ripple.setContour(points);
    elevation.setRadius(Math.max(0, baseRadius + (pressedRadius - baseRadius) * progress));
  }
  // Official Button.kt deliberately uses DefaultEffects to avoid overshooting corner radii.
  const spring = createSpring(0, draw, motionPreset(options.motionScheme, 'default.effects'));
  scope.add(() => spring.destroy());
  function geometry() {
    const token = buttonTokens[options.size ?? 'sm'];
    const style = getComputedStyle(element);
    const corner = Number.parseFloat(style.getPropertyValue('--eui-button-radius'));
    const pressed = Number.parseFloat(style.getPropertyValue('--eui-button-pressed-radius'));
    if (options.variant === 'outlined')
      renderer.insetStroke(
        Number.parseFloat(style.getPropertyValue('--eui-button-outline-width')) || token.outline,
      );
    const radius = Number.isFinite(corner)
      ? corner
      : options.shape === 'square'
        ? token.square
        : Infinity;
    baseRadius = Math.min(radius, width / 2, height / 2);
    pressedRadius = Math.min(
      Number.isFinite(pressed) ? pressed : token.pressed,
      width / 2,
      height / 2,
    );
    pair = alignContours(
      roundedRectangle(width, height, radius),
      roundedRectangle(width, height, Number.isFinite(pressed) ? pressed : token.pressed),
    );
    draw(spring.value);
  }
  function sync() {
    element.dataset.variant = options.variant ?? 'filled';
    element.dataset.size = options.size ?? 'sm';
    element.dataset.shape = options.shape ?? 'round';
    if (options.toggle) {
      element.setAttribute('aria-pressed', String(options.selected ?? false));
      element.dataset.selected = String(options.selected ?? false);
    } else {
      element.removeAttribute('aria-pressed');
      element.removeAttribute('data-selected');
    }
    spring.configure(motionPreset(options.motionScheme, 'default.effects'));
    geometry();
    colors?.configure(options.motionScheme ?? 'expressive');
    colors?.refresh();
    stateLayer.configure(options.motionScheme ?? 'expressive');
    elevation.configure(
      options.variant === 'elevated' ? 1 : 0,
      options.variant === 'elevated' ? 2 : 0,
      options.motionScheme ?? 'expressive',
    );
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
    bindPress(element, ({ pressed }) => {
      element.dataset.pressed = String(pressed);
      spring.setTarget(pressed ? 1 : 0);
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
    backend: renderer.backend,
    update(next: Partial<ButtonOptions>) {
      if (scope.disposed) return;
      options = { ...options, ...next };
      sync();
    },
    refresh() {
      if (!scope.disposed) {
        geometry();
        size.refresh();
      }
    },
    destroy() {
      scope.dispose();
    },
  };
}
