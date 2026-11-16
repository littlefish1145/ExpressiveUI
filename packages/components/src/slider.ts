import { bindPress, observeSize } from '@amiracle1024/core';
import { sliderTokens } from '@amiracle1024/tokens';
import { mount, decoration } from './shared.js';
import { svgElement, notifyChange } from './choice-shared.js';
import { animateColors } from './animated-styles.js';
import { createSpring, motionPreset } from '@amiracle1024/motion';
import type { MotionScheme } from '@amiracle1024/motion';
export interface SliderOptions {
  showValue?: 'interaction' | 'always' | 'never';
  /** Show spaced tick marks. Defaults to true only for an explicit numeric step. */
  showTicks?: boolean;
  formatValue?: (value: number) => string;
  motionScheme?: MotionScheme;
}
function setNativeValue(input: HTMLInputElement, value: number) {
  const prototype = input.ownerDocument.defaultView?.HTMLInputElement.prototype;
  const setter = prototype && Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (setter) setter.call(input, String(value));
  else input.value = String(value);
}
export function sliderMetrics(input: HTMLInputElement) {
  const min = input.min.trim() !== '' && Number.isFinite(Number(input.min)) ? Number(input.min) : 0;
  const rawMax =
    input.max.trim() !== '' && Number.isFinite(Number(input.max)) ? Number(input.max) : 100;
  const max = Math.max(min, rawMax),
    range = max - min;
  const rawValue = input.valueAsNumber;
  const value = Number.isFinite(rawValue) ? Math.min(max, Math.max(min, rawValue)) : min;
  const rawStep = Number(input.step);
  const step = input.step === 'any' ? null : rawStep > 0 && Number.isFinite(rawStep) ? rawStep : 1;
  return { min, max, range, value, step, fraction: range > 0 ? (value - min) / range : 0 };
}
/** Horizontal single-value Slider. Native range owns pointer, touch, form and value sanitization. */
export function enhanceSlider(input: HTMLInputElement, initial: SliderOptions = {}) {
  if (input.type !== 'range') throw new TypeError('Slider requires input[type=range]');
  if (!input.parentElement) throw new TypeError('Slider requires a dedicated wrapper');
  const host = input.parentElement;
  const scope = mount(input, 'eui-slider-input', ['aria-valuetext', 'data-discrete']);
  const hadClass = host.classList.contains('eui-slider');
  host.classList.add('eui-slider');
  scope.add(() => {
    if (!hadClass) host.classList.remove('eui-slider');
  });
  const visual = decoration('eui-slider-visual'),
    svg = svgElement('svg', {
      'aria-hidden': 'true',
      focusable: 'false',
      preserveAspectRatio: 'none',
    });
  const group = svgElement('g'),
    active = svgElement('path', { class: 'eui-slider-active' }),
    inactive = svgElement('path', { class: 'eui-slider-inactive' }),
    stop = svgElement('circle', {
      class: 'eui-slider-stop',
      cy: 24,
      r: sliderTokens.stopIndicatorSize / 2,
    });
  const ticks = svgElement('g', { class: 'eui-slider-ticks' });
  group.append(active, inactive, ticks, stop);
  svg.append(group);
  const handle = decoration('eui-slider-handle'),
    label = decoration('eui-slider-value');
  visual.append(svg, handle, label);
  input.after(visual);
  scope.add(() => visual.remove());
  const colors = animateColors(input, [
    { element: active, property: 'fill' },
    { element: inactive, property: 'fill' },
    { element: handle, property: 'background-color' },
  ]);
  scope.add(() => colors.destroy());
  let labelVisible = false;
  const labelOpacity = createSpring(
    0,
    (value) => (label.style.opacity = String(value)),
    motionPreset(initial.motionScheme, 'fast.effects'),
  );
  const labelScale = createSpring(
    0.8,
    (value) => (label.style.transform = `translateX(-50%) scale(${value})`),
    motionPreset(initial.motionScheme, 'fast.spatial'),
  );
  label.style.opacity = '0';
  const handleScale = createSpring(
    1,
    (value) => handle.style.setProperty('--_eui-handle-scale', String(value)),
    motionPreset(initial.motionScheme, 'fast.spatial'),
  );
  scope.add(() => {
    labelOpacity.destroy();
    labelScale.destroy();
    handleScale.destroy();
  });
  let options = { ...initial },
    width = 200,
    rtl = false,
    pressed = false,
    focused = false,
    keyboardChanged = false;
  let tickSignature = '',
    tickNodes: { fraction: number; node: SVGCircleElement }[] = [];
  function trackPath(start: number, end: number, leading: number, trailing: number) {
    if (end <= start) return '';
    const h = sliderTokens.activeTrackHeight,
      y = (48 - h) / 2,
      w = end - start;
    const scale = Math.min(
        1,
        w / (leading + trailing || 1),
        h / (leading * 2 || 1),
        h / (trailing * 2 || 1),
      ),
      a = leading * scale,
      b = trailing * scale;
    return `M${start + a} ${y}H${end - b}A${b} ${b} 0 0 1 ${end} ${y + b}V${y + h - b}A${b} ${b} 0 0 1 ${end - b} ${y + h}H${start + a}A${a} ${a} 0 0 1 ${start} ${y + h - a}V${y + a}A${a} ${a} 0 0 1 ${start + a} ${y}Z`;
  }
  function refresh() {
    if (scope.disposed) return;
    const metrics = sliderMetrics(input),
      { fraction, min, max, step, range, value } = metrics;
    const disabled = input.matches(':disabled');
    rtl = getComputedStyle(host).direction === 'rtl';
    const discrete = step !== null && range / step > 1;
    input.dataset.discrete = String(discrete);
    const trackWidth = Math.max(0, width - 4),
      center =
        2 +
        (discrete && fraction > 0 && fraction < 1
          ? 8 + Math.max(0, trackWidth - 16) * fraction
          : trackWidth * fraction);
    const handleWidth =
      !disabled && (pressed || focused)
        ? sliderTokens.pressedHandleWidth
        : sliderTokens.handleWidth;
    // Compose measures the outer thumb Box at 4px even when its painted handle narrows to 2px.
    const gap = sliderTokens.activeHandleLeadingSpace + sliderTokens.handleWidth / 2;
    svg.setAttribute('viewBox', `0 0 ${width} 48`);
    group.setAttribute('transform', rtl ? `translate(${width} 0) scale(-1 1)` : '');
    const activeVisible = center - gap - 2 > (discrete ? 8 : 0),
      inactiveVisible = center < width - 2 - gap - (discrete ? 8 : 0);
    active.setAttribute('d', activeVisible ? trackPath(2, center - gap, 8, 2) : '');
    inactive.setAttribute('d', inactiveVisible ? trackPath(center + gap, width - 2, 2, 8) : '');
    const stopX = width - 2 - 8;
    stop.setAttribute('cx', String(stopX));
    stop.setAttribute('visibility', inactiveVisible ? 'visible' : 'hidden');
    handle.style.transform = `translateX(${(rtl ? width - center : center) - 2}px) scaleX(var(--_eui-handle-scale,1))`;
    handleScale.setTarget(handleWidth / 4);
    const text = options.formatValue?.(value) ?? String(Number(value.toFixed(3)));
    label.textContent = text;
    label.style.left = `${rtl ? width - center : center}px`;
    const nextVisible =
      options.showValue === 'always' ||
      (options.showValue !== 'never' && (pressed || focused) && !disabled);
    label.dataset.visible = 'true';
    if (labelVisible !== nextVisible) {
      labelVisible = nextVisible;
      labelOpacity.setTarget(nextVisible ? 1 : 0);
      labelScale.setTarget(nextVisible ? 1 : 0.8);
    }
    if (options.formatValue) input.setAttribute('aria-valuetext', text);
    const showTicks = options.showTicks ?? (input.hasAttribute('step') && step !== null);
    const signature = `${min}|${max}|${step}|${showTicks}|${width}`;
    if (signature !== tickSignature) {
      tickSignature = signature;
      tickNodes = [];
      ticks.replaceChildren();
      const intervals = step && range > 0 ? Math.floor(range / step + 1e-9) : 0;
      // Keep 4px dots at least 12px apart without changing allowed input values.
      if (showTicks && intervals > 1) {
        const visibleIntervals = Math.max(1, Math.min(200, Math.floor((trackWidth - 16) / 12)));
        const stride = Math.max(1, Math.ceil(intervals / visibleIntervals));
        for (let i = 0; i < intervals; i += stride) {
          const node = svgElement('circle', { cy: 24, r: sliderTokens.stopIndicatorSize / 2 });
          const f = (i * step!) / range;
          tickNodes.push({ fraction: f, node });
          ticks.append(node);
        }
      }
    }
    for (const tick of tickNodes) {
      const x = 10 + Math.max(0, trackWidth - 16) * tick.fraction;
      tick.node.setAttribute('cx', String(x));
      tick.node.setAttribute('visibility', Math.abs(x - center) <= gap ? 'hidden' : 'visible');
      tick.node.setAttribute(
        'class',
        tick.fraction < fraction ? 'eui-slider-active-tick' : 'eui-slider-inactive-tick',
      );
    }
    colors.refresh();
  }
  const size = observeSize(host, (w) => {
    width = Math.max(4, w);
    refresh();
  });
  scope.add(() => size.destroy());
  scope.listen(input, 'input', () => {
    refresh();
    queueMicrotask(() => {
      if (!scope.disposed) refresh();
    });
  });
  scope.listen(input, 'change', () => refresh());
  scope.listen(input, 'focus', () => {
    focused = true;
    refresh();
  });
  scope.listen(input, 'blur', () => {
    focused = false;
    if (keyboardChanged) {
      keyboardChanged = false;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    refresh();
  });
  scope.add(
    bindPress(
      input,
      (state) => {
        pressed = state.pressed;
        refresh();
      },
      { cancelOnLeave: false },
    ),
  );
  scope.listen(input, 'keydown', (event) => {
    const e = event as KeyboardEvent;
    if (input.matches(':disabled') || e.altKey || e.ctrlKey || e.metaKey) return;
    const { min, max, value, range, step } = sliderMetrics(input),
      delta = step ?? range / 100;
    const actualSteps = step ? Math.max(1, Math.round(range / step)) : 100;
    const page = Math.max(1, Math.min(10, Math.floor(actualSteps / 10))) * delta;
    let next: number;
    switch (e.key) {
      case 'Home':
        next = min;
        break;
      case 'End':
        next = max;
        break;
      case 'ArrowRight':
        next = value + (rtl ? -delta : delta);
        break;
      case 'ArrowLeft':
        next = value + (rtl ? delta : -delta);
        break;
      case 'ArrowUp':
        next = value + delta;
        break;
      case 'ArrowDown':
        next = value - delta;
        break;
      case 'PageUp':
        next = value + page;
        break;
      case 'PageDown':
        next = value - page;
        break;
      default:
        return;
    }
    e.preventDefault();
    setNativeValue(input, Math.max(min, Math.min(max, next)));
    if (input.valueAsNumber !== value) {
      keyboardChanged = true;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    refresh();
  });
  scope.listen(input, 'keyup', (event) => {
    if (
      [
        'Home',
        'End',
        'ArrowRight',
        'ArrowLeft',
        'ArrowUp',
        'ArrowDown',
        'PageUp',
        'PageDown',
      ].includes((event as KeyboardEvent).key) &&
      keyboardChanged
    ) {
      keyboardChanged = false;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  if (input.form)
    scope.listen(input.form, 'reset', (event) => {
      queueMicrotask(() => {
        if (!scope.disposed && !event.defaultPrevented) refresh();
      });
    });
  const observer = new MutationObserver(() => refresh());
  observer.observe(input, {
    attributes: true,
    attributeFilter: ['value', 'min', 'max', 'step', 'disabled', 'dir'],
  });
  observer.observe(host, { attributes: true, attributeFilter: ['dir'] });
  let ancestor = host.parentElement;
  while (ancestor) {
    if (ancestor.tagName === 'FIELDSET')
      observer.observe(ancestor, { attributes: true, attributeFilter: ['disabled'] });
    ancestor = ancestor.parentElement;
  }
  scope.add(() => observer.disconnect());
  refresh();
  return {
    element: input,
    get value() {
      return input.valueAsNumber;
    },
    refresh() {
      if (!scope.disposed) {
        refresh();
        size.refresh();
      }
    },
    setValue(value: number, { notify = false }: { notify?: boolean } = {}) {
      if (scope.disposed) return;
      if (!Number.isFinite(value)) throw new TypeError('Finite slider value required');
      const before = input.value;
      input.value = String(value);
      refresh();
      if (before !== input.value && notify) notifyChange(input);
    },
    update(next: SliderOptions) {
      if (scope.disposed) return;
      options = { ...options, ...next };
      labelOpacity.configure(motionPreset(options.motionScheme, 'fast.effects'));
      labelScale.configure(motionPreset(options.motionScheme, 'fast.spatial'));
      handleScale.configure(motionPreset(options.motionScheme, 'fast.spatial'));
      colors.configure(options.motionScheme ?? 'expressive');
      refresh();
    },
    destroy() {
      scope.dispose();
    },
  };
}
