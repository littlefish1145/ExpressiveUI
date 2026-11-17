import { Scope } from '@epui/core';
import { createSpring, motionPreset } from '@epui/motion';
import type { MotionScheme } from '@epui/motion';
import { decoration } from './shared.js';
const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
/** Exact Material Web key/ambient shadow level ramps, including spread and separate alpha. */
export function elevationShadows(level: number) {
  const l = clamp(level, 0, 5);
  const keyY = clamp(l) + clamp(l - 3) + 2 * clamp(l - 4),
    keyBlur = 2 * clamp(l) + clamp(l - 2) + clamp(l - 4);
  const ambientY = clamp(l) + clamp(l - 1) + 2 * clamp(l - 2, 0, 3),
    ambientBlur = 3 * clamp(l, 0, 2) + 2 * clamp(l - 2, 0, 3),
    spread = clamp(l, 0, 4) + 2 * clamp(l - 4);
  return {
    key: `0 ${keyY}px ${keyBlur}px 0 var(--md-sys-color-shadow, #000)`,
    ambient: `0 ${ambientY}px ${ambientBlur}px ${spread}px var(--md-sys-color-shadow, #000)`,
  };
}
export function bindElevation(
  host: HTMLElement,
  base: number,
  hoverLevel: number,
  scheme: MotionScheme = 'expressive',
) {
  const scope = new Scope(),
    plane = decoration('eui-elevation'),
    key = decoration('eui-elevation-key'),
    ambient = decoration('eui-elevation-ambient');
  plane.append(key, ambient);
  host.prepend(plane);
  let currentBase = base,
    currentHover = hoverLevel,
    hover = false,
    pressed = false,
    currentScheme = scheme;
  const spring = createSpring(base, draw, motionPreset(scheme, 'fast.effects'));
  function draw(level: number) {
    const shadow = elevationShadows(level);
    key.style.boxShadow = shadow.key;
    ambient.style.boxShadow = shadow.ambient;
  }
  function sync() {
    const level = host.matches(':disabled')
      ? 0
      : pressed
        ? currentBase
        : hover
          ? currentHover
          : currentBase;
    spring.configure(motionPreset(currentScheme, 'fast.effects'));
    spring.setTarget(level);
  }
  scope.listen(host, 'pointerenter', (event) => {
    if ((event as PointerEvent).pointerType !== 'touch') {
      hover = true;
      sync();
    }
  });
  scope.listen(host, 'pointerleave', () => {
    hover = false;
    sync();
  });
  const observer = new MutationObserver(() => {
    pressed = host.dataset.pressed === 'true';
    sync();
  });
  observer.observe(host, { attributes: true, attributeFilter: ['data-pressed', 'disabled'] });
  scope.add(() => observer.disconnect());
  draw(base);
  return {
    setRadius(value: number) {
      plane.style.borderRadius = `${value}px`;
    },
    configure(nextBase: number, nextHover: number, nextScheme: MotionScheme) {
      currentBase = nextBase;
      currentHover = nextHover;
      currentScheme = nextScheme;
      sync();
    },
    destroy() {
      scope.dispose();
      spring.destroy();
      plane.remove();
    },
  };
}
