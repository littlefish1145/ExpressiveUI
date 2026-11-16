import { createSpring, motionPreset, observeReducedMotion } from '@expressive-ui/motion';
import type { MotionScheme } from '@expressive-ui/motion';
import { mount } from './shared.js';
import { choiceDecoration, observeChoice, notifyChange, svgElement } from './choice-shared.js';
import { animateColors } from './animated-styles.js';
export type CheckboxState = 'unchecked' | 'checked' | 'mixed';
export interface CheckboxOptions {
  motionScheme?: MotionScheme;
  error?: boolean;
}
export function enhanceCheckbox(input: HTMLInputElement, initial: CheckboxOptions = {}) {
  if (input.type !== 'checkbox') throw new TypeError('Checkbox requires input[type=checkbox]');
  if (!input.parentElement) throw new TypeError('Checkbox requires a wrapper');
  const scope = mount(input, 'eui-checkbox-input', ['aria-invalid']);
  const { svg } = choiceDecoration(input, scope, 'checkbox');
  let options = { ...initial },
    disabled = input.matches(':disabled'),
    lastState: CheckboxState = input.indeterminate
      ? 'mixed'
      : input.checked
        ? 'checked'
        : 'unchecked';
  let checkFraction = lastState === 'unchecked' ? 0 : 1,
    center = lastState === 'mixed' ? 1 : 0,
    fill = lastState === 'unchecked' ? 0 : 1;
  const outline = svgElement('rect', {
    class: 'eui-checkbox-outline',
    x: 1,
    y: 1,
    width: 16,
    height: 16,
    rx: 1,
    fill: 'none',
    'stroke-width': 2,
  });
  const background = svgElement('rect', {
    class: 'eui-checkbox-fill',
    x: 0,
    y: 0,
    width: 18,
    height: 18,
    rx: 2,
  });
  const check = svgElement('path', {
    class: 'eui-checkbox-mark',
    fill: 'none',
    'stroke-width': 2,
    'stroke-linecap': 'square',
    pathLength: 1,
    'stroke-dasharray': 1,
  });
  svg.append(outline, background, check);
  const colors = animateColors(
    input,
    [
      { element: background, property: 'fill' },
      { element: outline, property: 'stroke' },
      { element: check, property: 'stroke' },
    ],
    options.motionScheme,
  );
  scope.add(() => colors.destroy());
  function draw() {
    const t = center;
    check.setAttribute(
      'd',
      `M4.5 9 L${(7.2 + 1.8 * t).toFixed(4)} ${(11.7 - 2.7 * t).toFixed(4)} L13.5 ${(5.4 + 3.6 * t).toFixed(4)}`,
    );
    check.setAttribute('stroke-dashoffset', String(1 - Math.max(0, Math.min(1, checkFraction))));
    background.setAttribute(
      'opacity',
      String(Math.max(0, Math.min(1, fill)) * (disabled ? 0.38 : 1)),
    );
    outline.setAttribute(
      'opacity',
      String((1 - Math.max(0, Math.min(1, fill))) * (disabled ? 0.38 : 1)),
    );
  }
  const stroke = createSpring(
    checkFraction,
    (v) => {
      checkFraction = v;
      draw();
    },
    motionPreset(options.motionScheme, 'default.spatial'),
  );
  const centering = createSpring(
    center,
    (v) => {
      center = v;
      draw();
    },
    motionPreset(options.motionScheme, 'default.spatial'),
  );
  const color = createSpring(
    fill,
    (v) => {
      fill = v;
      draw();
    },
    motionPreset(options.motionScheme, 'default.effects'),
  );
  let snapTimer: ReturnType<typeof setTimeout> | undefined;
  const reduced = observeReducedMotion(() => {
    if (reduced.matches) refresh(false);
  });
  scope.add(() => {
    clearTimeout(snapTimer);
    reduced.destroy();
    stroke.destroy();
    centering.destroy();
    color.destroy();
  });
  function refresh(animate = true) {
    if (scope.disposed) return;
    disabled = input.matches(':disabled');
    const state: CheckboxState = input.indeterminate
      ? 'mixed'
      : input.checked
        ? 'checked'
        : 'unchecked';
    const target = state === 'unchecked' ? 0 : 1,
      mixed = state === 'mixed' ? 1 : 0;
    const changed = state !== lastState;
    if (!animate || disabled || reduced.matches) {
      clearTimeout(snapTimer);
      stroke.jump(target);
      centering.jump(mixed);
      color.jump(target);
    } else if (changed) {
      clearTimeout(snapTimer);
      color.configure(
        motionPreset(
          options.motionScheme,
          state === 'unchecked' ? 'fast.effects' : 'default.effects',
        ),
      );
      color.setTarget(target);
      if (state === 'unchecked') {
        snapTimer = setTimeout(() => {
          if (!scope.disposed) {
            stroke.jump(0);
            centering.jump(0);
          }
        }, 100);
      } else {
        if (lastState === 'unchecked') centering.jump(mixed);
        else centering.setTarget(mixed);
        stroke.setTarget(1);
      }
    }
    lastState = state;
    colors.refresh(animate, state === 'unchecked' ? 'fast.effects' : 'default.effects');
    draw();
  }
  function applyOptions() {
    if (options.error !== undefined) {
      if (options.error) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
    stroke.configure(motionPreset(options.motionScheme, 'default.spatial'));
    centering.configure(motionPreset(options.motionScheme, 'default.spatial'));
    colors.configure(options.motionScheme ?? 'expressive');
    refresh();
  }
  observeChoice(input, scope, refresh);
  applyOptions();
  draw();
  return {
    element: input,
    get state() {
      return input.indeterminate ? 'mixed' : input.checked ? 'checked' : 'unchecked';
    },
    refresh() {
      refresh();
    },
    setState(state: CheckboxState, { notify = false }: { notify?: boolean } = {}) {
      if (scope.disposed) return;
      if (!['unchecked', 'checked', 'mixed'].includes(state))
        throw new TypeError('Unknown checkbox state');
      const changed =
        state !== (input.indeterminate ? 'mixed' : input.checked ? 'checked' : 'unchecked');
      input.indeterminate = state === 'mixed';
      input.checked = state === 'checked';
      refresh();
      if (changed && notify) notifyChange(input);
    },
    update(next: CheckboxOptions) {
      if (scope.disposed) return;
      options = { ...options, ...next };
      applyOptions();
    },
    destroy() {
      scope.dispose();
    },
  };
}
