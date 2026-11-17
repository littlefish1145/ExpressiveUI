import { createSpring, motionPreset } from '@epui/motion';
import type { MotionScheme } from '@epui/motion';
import { mount } from './shared.js';
import { choiceDecoration, observeChoice, notifyChange, svgElement } from './choice-shared.js';
import { animateColors } from './animated-styles.js';
const radios = new Map<HTMLInputElement, (animate?: boolean) => void>();
function refreshGroup(input: HTMLInputElement, animate = true) {
  for (const [other, refresh] of radios)
    if (
      other === input ||
      (input.name &&
        other.name === input.name &&
        other.form === input.form &&
        other.getRootNode() === input.getRootNode())
    )
      refresh(animate);
}
export interface RadioOptions {
  motionScheme?: MotionScheme;
}
export function enhanceRadio(input: HTMLInputElement, initial: RadioOptions = {}) {
  if (input.type !== 'radio') throw new TypeError('Radio requires input[type=radio]');
  if (!input.parentElement) throw new TypeError('Radio requires a wrapper');
  const scope = mount(input, 'eui-radio-input', []),
    { svg, visual } = choiceDecoration(input, scope, 'radio');
  let options = { ...initial };
  const colors = animateColors(
    input,
    [{ element: visual, property: 'color' }],
    options.motionScheme,
  );
  scope.add(() => colors.destroy());
  const ring = svgElement('circle', {
    class: 'eui-radio-ring',
    cx: 10,
    cy: 10,
    r: 9,
    fill: 'none',
    'stroke-width': 2,
  });
  const dot = svgElement('circle', {
    class: 'eui-radio-dot',
    cx: 10,
    cy: 10,
    r: input.checked ? 5 : 0,
  });
  svg.append(ring, dot);
  const spring = createSpring(
    input.checked ? 1 : 0,
    (value) => {
      dot.setAttribute('r', String(Math.max(0, value * 6 - 1)));
    },
    motionPreset(options.motionScheme, 'fast.spatial'),
  );
  scope.add(() => spring.destroy());
  function refresh(animate = true) {
    if (scope.disposed) return;
    const next = input.checked ? 1 : 0;
    if (animate && !input.matches(':disabled')) spring.setTarget(next);
    else spring.jump(next);
    colors.refresh(animate);
  }
  radios.set(input, refresh);
  scope.add(() => radios.delete(input));
  observeChoice(input, scope, (animate) => refreshGroup(input, animate));
  refresh(false);
  return {
    element: input,
    refresh() {
      if (!scope.disposed) refreshGroup(input);
    },
    setChecked(checked: boolean, { notify = false }: { notify?: boolean } = {}) {
      if (scope.disposed) return;
      const changed = input.checked !== checked;
      input.checked = checked;
      refreshGroup(input);
      if (changed && notify) notifyChange(input);
    },
    update(next: RadioOptions) {
      if (scope.disposed) return;
      options = { ...options, ...next };
      spring.configure(motionPreset(options.motionScheme, 'fast.spatial'));
      colors.configure(options.motionScheme ?? 'expressive');
      colors.refresh();
    },
    destroy() {
      scope.dispose();
    },
  };
}
