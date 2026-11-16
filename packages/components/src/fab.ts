import { bindPress, observeSize } from '@expressive-ui/core';
import { createShapeRenderer, roundedRectangle } from '@expressive-ui/shape';
import type { ShapeBackend } from '@expressive-ui/shape';
import { createSpring, motionPreset } from '@expressive-ui/motion';
import type { MotionScheme } from '@expressive-ui/motion';
import { mount, decoration } from './shared.js';
import { bindRipple } from './ripple.js';
import { animateColors } from './animated-styles.js';
import { animateStateLayer } from './state-layer.js';
import { bindElevation } from './elevation.js';
export interface FabOptions {
  size?: 'small' | 'regular' | 'medium' | 'large';
  extended?: boolean;
  motionScheme?: MotionScheme;
  backend?: ShapeBackend;
}
export function enhanceFab(element: HTMLButtonElement, initial: FabOptions = {}) {
  const scope = mount(element, 'eui-fab', ['data-size', 'data-extended', 'data-pressed', 'style']);
  let options = { ...initial },
    width = 56,
    height = 56;
  const content = document.createElement('span');
  content.className = 'eui-content';
  content.append(...element.childNodes);
  const originalNodes = [...content.childNodes];
  const label = document.createElement('span');
  label.className = 'eui-fab-label';
  const hasIcon = !!content.querySelector('[data-icon]');
  if (hasIcon) {
    for (const node of [...content.childNodes])
      if (!(node instanceof Element && node.matches('[data-icon]'))) label.append(node);
    content.append(label);
  }
  element.append(content);
  scope.add(() => {
    if (label.parentNode) label.replaceWith(...label.childNodes);
    content.replaceWith(
      ...originalNodes,
      ...[...content.childNodes].filter((node) => !originalNodes.includes(node)),
    );
  });
  const surface = decoration('eui-surface'),
    state = decoration('eui-state');
  element.prepend(surface, state);
  const renderer = createShapeRenderer(surface, options.backend ?? 'svg'),
    overlay = createShapeRenderer(state, options.backend ?? 'svg');
  const ripple = bindRipple(element, element),
    stateLayer = animateStateLayer(element, state, options.motionScheme);
  scope.add(() => {
    ripple.destroy();
    stateLayer.destroy();
  });
  let colors: ReturnType<typeof animateColors> | undefined;
  const elevation = bindElevation(element, 3, 4, options.motionScheme);
  scope.add(() => elevation.destroy());
  scope.add(() => {
    renderer.destroy();
    overlay.destroy();
    surface.remove();
    state.remove();
  });
  let naturalLabelWidth = 0,
    expansionValue = options.extended ? 1 : 0,
    collapsedSize = 56,
    iconSize = 24,
    padding = 16,
    gap = 8,
    radius = 16;
  function renderExpansion() {
    if (!hasIcon) return;
    const p = expansionValue,
      expanded = Math.max(collapsedSize, iconSize + naturalLabelWidth + gap + padding * 2);
    width = Math.max(collapsedSize, collapsedSize + (expanded - collapsedSize) * p);
    element.style.width = `${width}px`;
    const inset = (collapsedSize - iconSize) / 2 + (padding - (collapsedSize - iconSize) / 2) * p;
    element.style.paddingInline = `${Math.max(0, inset)}px`;
    content.style.gap = `${Math.max(0, gap * p)}px`;
    label.style.width = `${Math.max(0, naturalLabelWidth * p)}px`;
    draw();
  }
  const expansion = createSpring(
    expansionValue,
    (value) => {
      expansionValue = value;
      renderExpansion();
    },
    motionPreset(options.motionScheme, 'fast.spatial'),
  );
  const labelAlpha = createSpring(
    expansionValue,
    (value) => {
      label.style.opacity = String(value);
    },
    motionPreset(options.motionScheme, 'fast.effects'),
  );
  scope.add(() => {
    expansion.destroy();
    labelAlpha.destroy();
  });
  function draw() {
    const points = roundedRectangle(width, height, radius);
    renderer.draw(points);
    overlay.draw(points);
    ripple.setContour(points);
  }
  function sync() {
    element.dataset.size = options.size ?? 'regular';
    element.dataset.extended = String(options.extended ?? false);
    const size = options.size ?? 'regular',
      promoted = size === 'small' && options.extended ? 'regular' : size;
    collapsedSize = { small: 40, regular: 56, medium: 80, large: 96 }[promoted];
    iconSize = { small: 24, regular: 24, medium: 28, large: 32 }[promoted];
    padding = promoted === 'medium' ? 26 : promoted === 'large' ? 28 : 16;
    gap = promoted === 'medium' ? 16 : promoted === 'large' ? 20 : 8;
    const override = Number.parseFloat(
      getComputedStyle(element).getPropertyValue('--eui-fab-radius'),
    );
    radius = Number.isFinite(override)
      ? override
      : { small: 12, regular: 16, medium: 20, large: 28 }[promoted];
    height = collapsedSize;
    if (hasIcon) {
      naturalLabelWidth = label.scrollWidth;
      expansion.configure(motionPreset(options.motionScheme, 'fast.spatial'));
      labelAlpha.configure(motionPreset(options.motionScheme, 'fast.effects'));
      expansion.setTarget(options.extended ? 1 : 0);
      labelAlpha.setTarget(options.extended ? 1 : 0);
      renderExpansion();
    }
    colors?.configure(options.motionScheme ?? 'expressive');
    colors?.refresh();
    stateLayer.configure(options.motionScheme ?? 'expressive');
    elevation.configure(3, 4, options.motionScheme ?? 'expressive');
    elevation.setRadius(radius);
    draw();
  }
  sync();
  label.style.opacity = String(expansionValue);
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
    draw();
  });
  scope.add(() => size.destroy());
  scope.add(
    bindPress(element, ({ pressed }) => {
      element.dataset.pressed = String(pressed);
    }),
  );
  return {
    element,
    backend: renderer.backend,
    update(next: Partial<FabOptions>) {
      if (scope.disposed) return;
      options = { ...options, ...next };
      sync();
    },
    refresh() {
      if (!scope.disposed) {
        sync();
        size.refresh();
      }
    },
    destroy() {
      scope.dispose();
    },
  };
}
