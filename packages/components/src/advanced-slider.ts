import { observeSize } from '@epui/core';
import { createSpring, motionPreset } from '@epui/motion';
import type { MotionScheme } from '@epui/motion';
import { mount, decoration } from './shared.js';
import { preserveAttributes } from './collection.js';
import { svgElement } from './svg.js';
import { sliderMetrics } from './slider.js';
export interface RangeSliderOptions {
  orientation?: 'horizontal' | 'vertical';
  showValue?: 'interaction' | 'always' | 'never';
  /** Show spaced tick marks. Defaults to true only for an explicit numeric step. */
  showTicks?: boolean;
  formatValue?: (value: number) => string;
  motionScheme?: MotionScheme;
}
function enhanceMultiSlider(inputs: HTMLInputElement[], options: RangeSliderOptions) {
  if (
    inputs.some((input) => input.type !== 'range') ||
    !inputs[0]?.parentElement ||
    inputs.some((input) => input.parentElement !== inputs[0]!.parentElement)
  )
    throw new TypeError('Slider inputs must share a dedicated wrapper');
  if (
    inputs.length === 2 &&
    (inputs[0]!.min !== inputs[1]!.min ||
      inputs[0]!.max !== inputs[1]!.max ||
      inputs[0]!.step !== inputs[1]!.step)
  )
    throw new TypeError('Range inputs must have matching min/max/step');
  const host = inputs[0]!.parentElement!,
    scope = mount(host, 'eui-multi-slider', ['style', 'data-orientation', 'data-disabled']);
  host.dataset.orientation = options.orientation ?? 'horizontal';
  const visual = decoration('eui-multi-slider-visual'),
    svg = svgElement('svg', { 'aria-hidden': 'true', preserveAspectRatio: 'none' }),
    group = svgElement('g'),
    left = svgElement('path', { class: 'eui-slider-inactive' }),
    active = svgElement('path', { class: 'eui-slider-active' }),
    right = svgElement('path', { class: 'eui-slider-inactive' }),
    ticks = svgElement('g');
  group.append(left, active, right, ticks);
  svg.append(group);
  visual.append(svg);
  host.append(visual);
  scope.add(() => visual.remove());
  let length = 240,
    drag: { pointer: number; index: number; rect: DOMRect; changed: boolean } | undefined,
    keyboardChanged = -1,
    tickSignature = '';
  let tickNodes: { fraction: number; node: SVGCircleElement }[] = [];
  const handles = inputs.map((input, index) => {
    preserveAttributes(scope, input, [
      'class',
      'aria-valuemin',
      'aria-valuemax',
      'aria-valuetext',
      'aria-orientation',
    ]);
    input.classList.add('eui-multi-slider-input');
    input.setAttribute('aria-orientation', options.orientation ?? 'horizontal');
    const handle = decoration('eui-slider-handle'),
      label = decoration('eui-slider-value');
    visual.append(handle, label);
    label.dataset.visible = 'true';
    label.style.opacity = '0';
    const opacity = createSpring(
        0,
        (v) => (label.style.opacity = String(v)),
        motionPreset(options.motionScheme, 'fast.effects'),
      ),
      scale = createSpring(
        0.8,
        (v) => label.style.setProperty('--_eui-value-scale', String(v)),
        motionPreset(options.motionScheme, 'fast.spatial'),
      );
    const handleScale = createSpring(
      1,
      (value) => handle.style.setProperty('--_eui-handle-scale', String(value)),
      motionPreset(options.motionScheme, 'fast.spatial'),
    );
    scope.add(() => {
      opacity.destroy();
      scale.destroy();
      handleScale.destroy();
    });
    scope.listen(input, 'focus', () => refresh());
    scope.listen(input, 'blur', () => {
      if (keyboardChanged === index) {
        keyboardChanged = -1;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      refresh();
    });
    scope.listen(input, 'input', () => {
      clampPair(index);
      refresh();
    });
    scope.listen(input, 'change', () => refresh());
    return { input, handle, label, opacity, scale, handleScale };
  });
  function clampPair(changed = 0) {
    if (inputs.length === 2 && inputs[0]!.valueAsNumber > inputs[1]!.valueAsNumber)
      inputs[changed]!.value = inputs[1 - changed]!.value;
  }
  function path(start: number, end: number, a: number, b: number) {
    if (end <= start) return '';
    const factor = Math.min(1, (end - start) / (a + b || 1));
    a *= factor;
    b *= factor;
    return `M${start + a} 16H${end - b}A${b} ${b} 0 0 1 ${end} ${16 + b}V${32 - b}A${b} ${b} 0 0 1 ${end - b} 32H${start + a}A${a} ${a} 0 0 1 ${start} ${32 - a}V${16 + a}A${a} ${a} 0 0 1 ${start + a} 16Z`;
  }
  function refresh() {
    if (scope.disposed) return;
    clampPair();
    const vertical = options.orientation === 'vertical',
      rtl = !vertical && getComputedStyle(host).direction === 'rtl',
      metrics = inputs.map(sliderMetrics),
      positions = metrics.map((m) => 2 + (length - 4) * m.fraction);
    svg.setAttribute('viewBox', vertical ? `0 0 48 ${length}` : `0 0 ${length} 48`);
    group.setAttribute(
      'transform',
      vertical
        ? `translate(0 ${length}) rotate(-90)`
        : rtl
          ? `translate(${length} 0) scale(-1 1)`
          : '',
    );
    const start = inputs.length === 2 ? positions[0]! : 2,
      end = positions.at(-1)!;
    left.setAttribute('d', inputs.length === 2 ? path(2, start - 8, 8, 2) : '');
    active.setAttribute(
      'd',
      path(inputs.length === 2 ? start + 8 : 2, end - 8, inputs.length === 2 ? 2 : 8, 2),
    );
    right.setAttribute('d', path(end + 8, length - 2, 2, 8));
    host.dataset.disabled = String(inputs.every((input) => input.matches(':disabled')));
    for (const [index, item] of handles.entries()) {
      const position = positions[index]!,
        focused = document.activeElement === item.input,
        pressed = drag?.index === index,
        disabled = item.input.matches(':disabled');
      const x = vertical ? 24 : rtl ? length - position : position,
        y = vertical ? length - position : 24;
      item.handle.dataset.focusVisible = String(focused && item.input.matches(':focus-visible'));
      item.handle.style.setProperty('--_eui-handle-x', `${vertical ? x - 22 : x - 2}px`);
      item.handle.style.setProperty('--_eui-handle-y', `${vertical ? y - 2 : 2}px`);
      item.handleScale.setTarget(!disabled && (focused || pressed) ? 0.5 : 1);
      item.label.style.left = `${vertical ? x + 32 : x}px`;
      item.label.style.top = vertical ? `${y}px` : '';
      item.label.textContent =
        options.formatValue?.(metrics[index]!.value) ??
        String(Number(metrics[index]!.value.toFixed(2)));
      if (options.formatValue) item.input.setAttribute('aria-valuetext', item.label.textContent);
      const show =
        options.showValue === 'always' ||
        (options.showValue !== 'never' && !disabled && (focused || pressed));
      item.opacity.setTarget(show ? 1 : 0);
      item.scale.setTarget(show ? 1 : 0.8);
      if (inputs.length === 2) {
        item.input.setAttribute(
          'aria-valuemin',
          String(index ? metrics[0]!.value : metrics[index]!.min),
        );
        item.input.setAttribute(
          'aria-valuemax',
          String(index ? metrics[index]!.max : metrics[1]!.value),
        );
      }
    }
    const m = metrics[0]!,
      showTicks = options.showTicks ?? (inputs[0]!.hasAttribute('step') && m.step !== null),
      signature = `${m.min}|${m.max}|${m.step}|${showTicks}|${length}`;
    if (signature !== tickSignature) {
      tickSignature = signature;
      tickNodes = [];
      ticks.replaceChildren();
      if (showTicks && m.step && m.range / m.step > 1) {
        const count = Math.floor(m.range / m.step + 1e-9),
          visibleIntervals = Math.max(1, Math.min(199, Math.floor((length - 4) / 12))),
          stride = Math.max(1, Math.ceil(count / visibleIntervals));
        for (let index = 0; index <= count; index += stride) {
          const node = svgElement('circle', { cy: 24, r: 2 });
          tickNodes.push({ fraction: (index * m.step) / m.range, node });
          ticks.append(node);
        }
      }
    }
    for (const { fraction, node } of tickNodes) {
      const x = 2 + (length - 4) * fraction;
      node.setAttribute('cx', String(x));
      node.setAttribute(
        'visibility',
        positions.some((p) => Math.abs(p - x) < 8) ? 'hidden' : 'visible',
      );
      node.setAttribute(
        'class',
        x >= start && x <= end ? 'eui-slider-active-tick' : 'eui-slider-inactive-tick',
      );
    }
  }
  function set(index: number, value: number, notify = false) {
    const input = inputs[index]!,
      before = input.value;
    input.value = String(value);
    clampPair(index);
    refresh();
    if (notify && input.value !== before)
      input.dispatchEvent(new Event('input', { bubbles: true }));
    return input.value !== before;
  }
  scope.listen(host, 'pointerdown', (event) => {
    const e = event as PointerEvent;
    if (e.button !== 0) return;
    const rect = host.getBoundingClientRect(),
      vertical = options.orientation === 'vertical',
      rtl = !vertical && getComputedStyle(host).direction === 'rtl';
    let f = vertical
      ? 1 - (e.clientY - rect.top) / (rect.height || length)
      : (e.clientX - rect.left) / (rect.width || length);
    if (rtl) f = 1 - f;
    let index = -1,
      distance = Infinity;
    for (let i = 0; i < inputs.length; i++) {
      if (inputs[i]!.matches(':disabled')) continue;
      const d = Math.abs(sliderMetrics(inputs[i]!).fraction - f);
      if (d < distance) {
        distance = d;
        index = i;
      }
    }
    if (index < 0) return;
    e.preventDefault();
    drag = { pointer: e.pointerId, index, rect, changed: false };
    try {
      host.setPointerCapture(e.pointerId);
    } catch {}
    inputs[index]!.focus();
    move(e);
    refresh();
  });
  function move(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.pointer) return;
    const vertical = options.orientation === 'vertical',
      rtl = !vertical && getComputedStyle(host).direction === 'rtl',
      r = drag.rect;
    let f = vertical
      ? 1 - (e.clientY - r.top) / (r.height || length)
      : (e.clientX - r.left) / (r.width || length);
    if (rtl) f = 1 - f;
    const m = sliderMetrics(inputs[drag.index]!);
    drag.changed =
      set(drag.index, m.min + Math.max(0, Math.min(1, f)) * m.range, true) || drag.changed;
  }
  scope.listen(host, 'pointermove', (event) => move(event as PointerEvent));
  function release(event: Event) {
    const e = event as PointerEvent;
    if (!drag || e.pointerId !== drag.pointer) return;
    const old = drag;
    drag = undefined;
    if (old.changed) inputs[old.index]!.dispatchEvent(new Event('change', { bubbles: true }));
    refresh();
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
    scope.listen(host, type, release);
  for (const [index, input] of inputs.entries()) {
    scope.listen(input, 'keydown', (event) => {
      const e = event as KeyboardEvent;
      if (input.matches(':disabled') || e.altKey || e.ctrlKey || e.metaKey) return;
      const m = sliderMetrics(input),
        delta = m.step ?? m.range / 100,
        rtl = options.orientation !== 'vertical' && getComputedStyle(host).direction === 'rtl';
      let value = m.value;
      switch (e.key) {
        case 'Home':
          value = m.min;
          break;
        case 'End':
          value = m.max;
          break;
        case 'ArrowUp':
          value += delta;
          break;
        case 'ArrowDown':
          value -= delta;
          break;
        case 'ArrowRight':
          value += rtl ? -delta : delta;
          break;
        case 'ArrowLeft':
          value += rtl ? delta : -delta;
          break;
        case 'PageUp':
          value += delta * Math.max(1, Math.min(10, Math.floor(m.range / delta / 10)));
          break;
        case 'PageDown':
          value -= delta * Math.max(1, Math.min(10, Math.floor(m.range / delta / 10)));
          break;
        default:
          return;
      }
      e.preventDefault();
      if (set(index, Math.max(m.min, Math.min(m.max, value)), true)) keyboardChanged = index;
    });
    scope.listen(input, 'keyup', (event) => {
      if (
        keyboardChanged === index &&
        [
          'Home',
          'End',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'PageUp',
          'PageDown',
        ].includes((event as KeyboardEvent).key)
      ) {
        keyboardChanged = -1;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }
  const form = inputs[0]!.form;
  if (form)
    scope.listen(form, 'reset', (event) =>
      queueMicrotask(() => {
        if (!event.defaultPrevented) refresh();
      }),
    );
  const observer = new MutationObserver(() => refresh());
  for (const input of inputs)
    observer.observe(input, {
      attributes: true,
      attributeFilter: ['min', 'max', 'step', 'value', 'disabled'],
    });
  scope.add(() => observer.disconnect());
  const size = observeSize(host, (w, h) => {
    length = Math.max(4, options.orientation === 'vertical' ? h : w);
    refresh();
  });
  scope.add(() => size.destroy());
  refresh();
  return {
    element: host,
    get values() {
      return inputs.map((input) => input.valueAsNumber);
    },
    setValues(values: readonly number[], { notify = false } = {}) {
      if (scope.disposed) return;
      if (values.length !== inputs.length || values.some((v) => !Number.isFinite(v)))
        throw new RangeError('One finite value per handle required');
      const before = inputs.map((input) => input.value);
      inputs.forEach((input, index) => (input.value = String(values[index])));
      clampPair();
      refresh();
      if (notify)
        inputs.forEach((input, index) => {
          if (before[index] !== input.value) {
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
    },
    refresh,
    update(next: Partial<Omit<RangeSliderOptions, 'orientation'>>) {
      if (scope.disposed) return;
      Object.assign(options, next);
      for (const item of handles) {
        item.opacity.configure(motionPreset(options.motionScheme, 'fast.effects'));
        item.scale.configure(motionPreset(options.motionScheme, 'fast.spatial'));
        item.handleScale.configure(motionPreset(options.motionScheme, 'fast.spatial'));
      }
      refresh();
    },
    destroy() {
      scope.dispose();
    },
  };
}
export function enhanceRangeSlider(
  start: HTMLInputElement,
  end: HTMLInputElement,
  options: RangeSliderOptions = {},
) {
  return enhanceMultiSlider([start, end], options);
}
export function enhanceVerticalSlider(
  input: HTMLInputElement,
  options: Omit<RangeSliderOptions, 'orientation'> = {},
) {
  return enhanceMultiSlider([input], { ...options, orientation: 'vertical' });
}
