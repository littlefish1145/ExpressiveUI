import { Scope } from '@epui/core';
import { parseColor, createColorSpring, colorCSS, motionPreset } from '@epui/motion';
import type { MotionScheme, MotionToken } from '@epui/motion';
export interface ColorBinding {
  element: HTMLElement | SVGElement;
  property: string;
}
const ancestors = new Map<Element, { observer: MutationObserver; listeners: Set<() => void> }>();
const animatedProperties = new WeakMap<Element, Map<string, number>>();
function colorStyleSignature(element: HTMLElement) {
  const values: string[] = [];
  for (let i = 0; i < element.style.length; i++) {
    const name = element.style.item(i);
    // Our own frame writes are output, not new ancestor theme inputs.
    if (animatedProperties.get(element)?.has(name)) continue;
    if (
      (name.startsWith('--') && !name.startsWith('--_')) ||
      /^(all|color|background.*|border.*color|fill|stroke)$/.test(name)
    )
      values.push(
        `${name}:${element.style.getPropertyValue(name)}!${element.style.getPropertyPriority(name)}`,
      );
  }
  return values.sort().join(';');
}
function watchAncestors(host: HTMLElement, changed: () => void) {
  const owned: Element[] = [];
  let node = host.parentElement;
  while (node) {
    const ancestor = node;
    let item = ancestors.get(ancestor);
    if (!item) {
      const listeners = new Set<() => void>();
      let signature = colorStyleSignature(ancestor);
      const observer = new MutationObserver((records) => {
        const next = colorStyleSignature(ancestor),
          structural = records.some((record) => record.attributeName !== 'style');
        if (!structural && next === signature) return;
        signature = next;
        for (const listener of listeners) listener();
      });
      observer.observe(ancestor, {
        attributes: true,
        attributeFilter: ['style', 'class', 'data-theme', 'disabled', 'dir'],
      });
      item = { observer, listeners };
      ancestors.set(ancestor, item);
    }
    item.listeners.add(changed);
    owned.push(ancestor);
    node = node.parentElement;
  }
  return () => {
    for (const ancestor of owned) {
      const item = ancestors.get(ancestor)!;
      item.listeners.delete(changed);
      if (!item.listeners.size) {
        item.observer.disconnect();
        ancestors.delete(ancestor);
      }
    }
  };
}
/** Reads target CSS only on state/theme changes; never reads style or layout on an animation frame. */
export function animateColors(
  host: HTMLElement,
  bindings: ColorBinding[],
  scheme: MotionScheme = 'expressive',
) {
  const scope = new Scope();
  let currentScheme = scheme,
    initialized = false,
    refreshPending = false;
  const states = bindings.map((binding) => ({
    ...binding,
    original: binding.element.style.getPropertyValue(binding.property),
    priority: binding.element.style.getPropertyPriority(binding.property),
    spring: undefined as ReturnType<typeof createColorSpring> | undefined,
    target: '',
  }));
  for (const state of states) {
    let properties = animatedProperties.get(state.element);
    if (!properties) {
      properties = new Map();
      animatedProperties.set(state.element, properties);
    }
    properties.set(state.property, (properties.get(state.property) ?? 0) + 1);
  }
  function refresh(animate = true, token: MotionToken = 'default.effects') {
    if (scope.disposed) return;
    const current = states.map((s) => s.element.style.getPropertyValue(s.property));
    for (const s of states)
      if (s.original) s.element.style.setProperty(s.property, s.original, s.priority);
      else s.element.style.removeProperty(s.property);
    const targets = states.map((s) => {
      const computed = getComputedStyle(s.element);
      const raw = computed.getPropertyValue(s.property);
      return raw.toLowerCase() === 'currentcolor' ? computed.color : raw;
    });
    states.forEach((s, i) => {
      if (current[i]) s.element.style.setProperty(s.property, current[i]!);
    });
    const enabled = !host.matches(':disabled');
    states.forEach((s, i) => {
      const raw = targets[i]!,
        color = parseColor(raw);
      if (!color) {
        // A CSS override may use a color space this runtime does not parse.
        // Release the previous animation so it cannot overwrite that native color.
        s.spring?.destroy();
        s.spring = undefined;
        s.target = '';
        if (s.original) s.element.style.setProperty(s.property, s.original, s.priority);
        else s.element.style.removeProperty(s.property);
        return;
      }
      if (!s.spring) {
        s.spring = createColorSpring(
          color,
          (color) => s.element.style.setProperty(s.property, colorCSS(color)),
          motionPreset(currentScheme, token),
        );
        s.element.style.setProperty(s.property, colorCSS(color));
      }
      s.spring.configure(motionPreset(currentScheme, token));
      if (raw !== s.target || !animate || !enabled) {
        s.target = raw;
        s.spring.setTarget(color, initialized && animate && enabled);
      }
    });
    initialized = true;
  }
  function deferred() {
    if (refreshPending || scope.disposed) return;
    refreshPending = true;
    queueMicrotask(() => {
      refreshPending = false;
      refresh();
    });
  }
  for (const type of [
    'input',
    'change',
    'pointerenter',
    'pointerleave',
    'pointerdown',
    'pointerup',
    'pointercancel',
    'focus',
    'blur',
    'keydown',
    'keyup',
  ])
    scope.listen(host, type, deferred);
  const observer = new MutationObserver(deferred);
  observer.observe(host, {
    attributes: true,
    attributeFilter: [
      'class',
      'data-selected',
      'data-pressed',
      'data-variant',
      'data-shape',
      'disabled',
      'checked',
      'aria-invalid',
      'aria-checked',
      'aria-pressed',
    ],
  });
  scope.add(() => observer.disconnect());
  scope.add(watchAncestors(host, deferred));
  refresh(false);
  return {
    refresh,
    configure(next: MotionScheme) {
      currentScheme = next;
    },
    destroy() {
      if (scope.disposed) return;
      scope.dispose();
      for (const s of states) {
        s.spring?.destroy();
        if (s.original) s.element.style.setProperty(s.property, s.original, s.priority);
        else s.element.style.removeProperty(s.property);
        const properties = animatedProperties.get(s.element)!;
        const count = properties.get(s.property)! - 1;
        if (count) properties.set(s.property, count);
        else properties.delete(s.property);
        if (!properties.size) animatedProperties.delete(s.element);
      }
    },
  };
}
