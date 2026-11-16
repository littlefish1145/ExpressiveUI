import { Scope } from '@amiracle1024/core';
import { createSpring, motionPreset } from '@amiracle1024/motion';
import type { MotionScheme } from '@amiracle1024/motion';
export function animateStateLayer(
  host: HTMLElement,
  layer: HTMLElement,
  initial: MotionScheme = 'expressive',
) {
  const scope = new Scope();
  let hovered = false,
    focused = false,
    scheme = initial;
  const original = layer.style.opacity;
  const spring = createSpring(
    0,
    (value) => (layer.style.opacity = String(value)),
    motionPreset(scheme, 'default.effects'),
  );
  layer.style.opacity = '0';
  function refresh() {
    spring.configure(motionPreset(scheme, 'default.effects'));
    if (host.matches(':disabled')) spring.jump(0);
    else spring.setTarget(focused ? 0.1 : hovered ? 0.08 : 0);
  }
  scope.listen(host, 'pointerenter', (event) => {
    if ((event as PointerEvent).pointerType !== 'touch') {
      hovered = true;
      refresh();
    }
  });
  scope.listen(host, 'pointerleave', () => {
    hovered = false;
    refresh();
  });
  scope.listen(host, 'focus', () => {
    focused = host.matches(':focus-visible');
    refresh();
  });
  scope.listen(host, 'blur', () => {
    focused = false;
    refresh();
  });
  const observer = new MutationObserver(refresh);
  observer.observe(host, { attributes: true, attributeFilter: ['disabled'] });
  scope.add(() => observer.disconnect());
  let ancestor = host.parentElement;
  while (ancestor) {
    if (ancestor.tagName === 'FIELDSET')
      observer.observe(ancestor, { attributes: true, attributeFilter: ['disabled'] });
    ancestor = ancestor.parentElement;
  }
  return {
    configure(next: MotionScheme) {
      scheme = next;
      refresh();
    },
    destroy() {
      scope.dispose();
      spring.destroy();
      layer.style.opacity = original;
    },
  };
}
