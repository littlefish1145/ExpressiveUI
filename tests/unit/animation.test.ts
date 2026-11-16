import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import heartCircle from '../../packages/shape/src/morph-data/heart-circle.js';
import burstCookie from '../../packages/shape/src/morph-data/softBurst-cookie9Sided.js';
import pillTriangle from '../../packages/shape/src/morph-data/pill-triangle.js';
import {
  createSpring,
  createColorSpring,
  parseColor,
  rgbaToOklab,
  oklabToRgba,
  motionPreset,
  setMotionPreference,
  observeReducedMotion,
  activeAnimationCount,
} from '@amiracle1024/motion';
import {
  enhanceButton,
  enhanceIconButton,
  enhanceFab,
  enhanceCheckbox,
  enhanceRadio,
  enhanceSwitch,
  enhanceSlider,
} from '@amiracle1024/components';
import {
  createMorph,
  createShapeRenderer,
  roundedRectangleCubics,
  cubicControlBounds,
  shapeRotationScale,
} from '@amiracle1024/shape';
import { rippleFrame } from '../../packages/components/src/ripple.js';
import { loadingFrame, loadingMorphDuration } from '../../packages/components/src/loading-model.js';
import { elevationShadows } from '../../packages/components/src/elevation.js';
import { animateColors } from '../../packages/components/src/animated-styles.js';
const owned: { destroy(): void }[] = [];
let frame: { step(ms?: number): void; flush(n?: number): void };
beforeEach(() => {
  let time = 0,
    id = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    callbacks.set(++id, fn);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
  frame = {
    step(ms = 1000 / 60) {
      time += ms;
      const pending = [...callbacks.values()];
      callbacks.clear();
      for (const fn of pending) fn(time);
    },
    flush(n = 100) {
      for (let i = 0; i < n; i++) this.step();
    },
  };
  const media = new EventTarget() as MediaQueryList;
  Object.defineProperty(media, 'matches', { value: false });
  vi.stubGlobal('matchMedia', () => media);
  setMotionPreference('full');
});
afterEach(() => {
  for (const c of owned.splice(0).reverse()) c.destroy();
  document.body.replaceChildren();
  for (const style of document.head.querySelectorAll('[data-test-css]')) style.remove();
  setMotionPreference('system');
  vi.unstubAllGlobals();
  expect(activeAnimationCount()).toBe(0);
});
const own = <T extends { destroy(): void }>(c: T) => {
  owned.push(c);
  return c;
};
function nativeInput(type: string) {
  const input = document.createElement('input'),
    wrapper = document.createElement('span');
  input.type = type;
  wrapper.append(input);
  document.body.append(wrapper);
  return input;
}
function button() {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = 'Action';
  document.body.append(b);
  return b;
}
function css(text: string) {
  const style = document.createElement('style');
  style.dataset.testCss = 'true';
  style.textContent = text;
  document.head.append(style);
}
describe('real intermediate frames (full motion, deterministic rAF)', () => {
  it('shows Button shape movement and a ripple that survives a quick click', () => {
    const b = button();
    own(enhanceButton(b));
    const shape = b.querySelector('.eui-surface path')!,
      before = shape.getAttribute('d');
    b.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    frame.flush(3);
    expect(shape.getAttribute('d')).not.toBe(before);
    b.dispatchEvent(new KeyboardEvent('keyup', { key: ' ' }));
    frame.flush(4);
    const circles = [...b.querySelectorAll('.eui-ripple circle')];
    expect(circles.some((c) => Number(c.getAttribute('opacity')) > 0)).toBe(true);
    frame.flush();
    expect(circles.every((c) => Number(c.getAttribute('opacity')) === 0)).toBe(true);
    expect(shape.getAttribute('d')).toBe(before);
  });
  it('animates Icon Button selection over multiple frames', () => {
    const b = button(),
      c = own(enhanceIconButton(b, { toggle: true }));
    const p = b.querySelector('.eui-surface path')!,
      initial = p.getAttribute('d');
    c.setSelected(true);
    expect(p.getAttribute('d')).toBe(initial);
    frame.flush(3);
    const middle = p.getAttribute('d');
    expect(middle).not.toBe(initial);
    frame.flush();
    expect(p.getAttribute('d')).not.toBe(middle);
  });
  it('draws Checkbox incrementally rather than jumping to the final check', () => {
    const input = nativeInput('checkbox'),
      c = own(enhanceCheckbox(input));
    c.setState('checked');
    frame.flush(3);
    const mark = input.parentElement!.querySelector('.eui-checkbox-mark')!;
    const middle = Number(mark.getAttribute('stroke-dashoffset'));
    expect(middle).toBeGreaterThan(0);
    expect(middle).toBeLessThan(1);
    frame.flush();
    expect(Number(mark.getAttribute('stroke-dashoffset'))).toBe(0);
  });
  it('animates the Radio dot to the official final radius', () => {
    const input = nativeInput('radio'),
      c = own(enhanceRadio(input));
    c.setChecked(true);
    frame.flush(3);
    const dot = input.parentElement!.querySelector('.eui-radio-dot')!;
    expect(Number(dot.getAttribute('r'))).toBeGreaterThan(0);
    expect(Number(dot.getAttribute('r'))).toBeLessThan(5);
    frame.flush();
    expect(Number(dot.getAttribute('r'))).toBe(5);
  });
  it('animates Switch travel and handle size, preserving a continuous transition', () => {
    const input = nativeInput('checkbox'),
      c = own(enhanceSwitch(input));
    const thumb = input.parentElement!.querySelector<HTMLElement>('.eui-switch-thumb')!;
    const start = thumb.style.transform;
    c.setChecked(true);
    frame.flush(3);
    const mid = thumb.style.transform;
    expect(mid).not.toBe(start);
    expect(mid).not.toBe('translateX(20px) scale(1)');
    frame.flush();
    expect(thumb.style.transform).toBe('translateX(20px) scale(1)');
  });
  it('fades/scales the Slider value label without lagging behind native input', () => {
    const input = nativeInput('range'),
      c = own(enhanceSlider(input));
    const label = input.parentElement!.querySelector<HTMLElement>('.eui-slider-value')!;
    input.dispatchEvent(new Event('focus'));
    frame.flush(3);
    expect(Number(label.style.opacity)).toBeGreaterThan(0);
    expect(Number(label.style.opacity)).toBeLessThan(1);
    c.setValue(80);
    expect(input.valueAsNumber).toBe(80);
    input.dispatchEvent(new Event('blur'));
    frame.flush();
    expect(Number(label.style.opacity)).toBe(0);
  });
  it('expands/collapses Extended FAB using spatial width and effects alpha', () => {
    const b = button();
    b.innerHTML = '<span data-icon>+</span>Compose';
    const c = own(enhanceFab(b));
    const label = b.querySelector<HTMLElement>('.eui-fab-label')!;
    Object.defineProperty(label, 'scrollWidth', { value: 120 });
    c.update({ extended: true });
    frame.flush(3);
    expect(parseFloat(b.style.width)).toBeGreaterThan(56);
    expect(parseFloat(b.style.width)).toBeLessThan(184);
    expect(Number(label.style.opacity)).toBeGreaterThan(0);
    frame.flush();
    expect(parseFloat(b.style.width)).toBe(184);
    c.update({ extended: false });
    frame.flush();
    expect(parseFloat(b.style.width)).toBe(56);
  });
  it('animates CSS target colors with Oklab and restores authored inline values', () => {
    css('.target{color:rgb(255, 0, 0)} .target[data-on="true"]{color:rgb(0, 0, 255)}');
    const host = document.createElement('div');
    host.className = 'target';
    document.body.append(host);
    const colors = own(animateColors(host, [{ element: host, property: 'color' }]));
    expect(parseColor(host.style.color)?.[0]).toBeCloseTo(1);
    host.dataset.on = 'true';
    colors.refresh();
    frame.flush(4);
    const middle = parseColor(host.style.color)!;
    expect(middle[0]).toBeGreaterThan(0);
    expect(middle[2]).toBeGreaterThan(0);
    expect(middle[0]).toBeLessThan(1);
    frame.flush();
    expect(parseColor(host.style.color)?.[2]).toBeCloseTo(1);
    colors.destroy();
    expect(host.style.color).toBe('');
  });
  it('releases an active color spring when the browser reports a native wide-gamut color', () => {
    css('.wide{color:rgb(255,0,0)} .wide[data-on="true"]{color:rgb(0,0,255)}');
    const host = document.createElement('div');
    host.className = 'wide';
    document.body.append(host);
    // happy-dom cannot compute display-p3; simulate that browser CSSOM boundary.
    const original = getComputedStyle;
    const getter = vi
      .spyOn(globalThis, 'getComputedStyle')
      .mockImplementation((element, pseudo) => {
        if (element === host && host.dataset.native === 'true')
          return {
            color: 'color(display-p3 0 1 0)',
            getPropertyValue: () => 'color(display-p3 0 1 0)',
          } as unknown as CSSStyleDeclaration;
        return original(element, pseudo);
      });
    own({ destroy: () => getter.mockRestore() });
    const colors = own(animateColors(host, [{ element: host, property: 'color' }]));
    host.dataset.on = 'true';
    colors.refresh();
    frame.flush(3);
    expect(activeAnimationCount()).toBeGreaterThan(0);
    host.dataset.native = 'true';
    colors.refresh();
    expect(host.style.color).toBe('');
    frame.flush();
    expect(host.style.color).toBe('');
    expect(getComputedStyle(host).color).toContain('display-p3');
    expect(activeAnimationCount()).toBe(0);
  });
  it('disposes active ripples, color channels, observers and shapes together', () => {
    const b = button(),
      c = own(enhanceButton(b));
    for (let i = 0; i < 20; i++) b.click();
    frame.flush(2);
    expect(b.querySelectorAll('.eui-ripple circle')).toHaveLength(4);
    expect(activeAnimationCount()).toBeGreaterThan(0);
    c.destroy();
    expect(b.querySelector('svg')).toBe(null);
    expect(activeAnimationCount()).toBe(0);
  });
});
describe('motion policy, source colors and timing', () => {
  it('can explicitly preview full motion while the OS requests reduced motion', () => {
    const media = new EventTarget() as MediaQueryList;
    Object.defineProperty(media, 'matches', { value: true });
    vi.stubGlobal('matchMedia', () => media);
    setMotionPreference('system');
    const preference = own(observeReducedMotion());
    expect(preference.matches).toBe(true);
    const spring = own(createSpring(0, () => {}));
    spring.setTarget(1);
    expect(spring.value).toBe(1);
    setMotionPreference('full');
    spring.jump(0);
    spring.setTarget(1);
    expect(spring.value).toBe(0);
    frame.flush(3);
    expect(spring.value).toBeGreaterThan(0);
    expect(spring.value).toBeLessThan(1);
    setMotionPreference('reduced');
    expect(spring.value).toBe(1);
    expect(preference.matches).toBe(true);
  });
  it('converts sRGB to Oklab and back with a known red reference', () => {
    const lab = rgbaToOklab([1, 0, 0, 1]);
    expect(lab[0]).toBeCloseTo(0.62795536, 6);
    expect(lab[1]).toBeCloseTo(0.22486306, 6);
    expect(lab[2]).toBeCloseTo(0.1258463, 6);
    for (const rgba of [
      [1, 0, 0, 1],
      [0, 1, 0, 0.4],
      [0, 0, 1, 1],
      [0.2, 0.5, 0.7, 0.8],
    ] as const) {
      const roundtrip = oklabToRgba(rgbaToOklab(rgba));
      roundtrip.forEach((v, i) => expect(v).toBeCloseTo(rgba[i]!, 5));
    }
  });
  it('retains per-channel color velocity on retargeting', () => {
    const c = own(createColorSpring([1, 0, 0, 1], () => {}, motionPreset()));
    c.setTarget([0, 0, 1, 1]);
    frame.flush(5);
    const velocity = c.velocity;
    c.setTarget([0, 1, 0, 1]);
    expect(c.velocity).toEqual(velocity);
  });
  it('matches the official ripple 75/225/150 ms phases and radius', () => {
    expect(rippleFrame(0.075, null, 100, 40).alpha).toBe(1);
    expect(rippleFrame(0.225, 0.02, 100, 40).radius).toBeCloseTo(Math.hypot(100, 40) / 2 + 10, 5);
    expect(rippleFrame(0.3, 0.02, 100, 40).alpha).toBeCloseTo(0.5, 6);
    expect(rippleFrame(0.375, 0.02, 100, 40).done).toBe(true);
    expect(rippleFrame(2, null, 40, 40, false, 20).radius).toBeCloseTo(20, 5);
  });
  it('uses official Loading spring completion and holds until the next 650 ms cycle', () => {
    expect(loadingMorphDuration).toBeGreaterThan(0.29);
    expect(loadingMorphDuration).toBeLessThan(0.31);
    expect(loadingFrame(0)).toEqual({ index: 0, progress: 0, rotation: 90 });
    expect(loadingFrame(0.4)).toEqual({ index: 1, progress: 0, rotation: 180 });
    expect(loadingFrame(0.65)).toEqual({ index: 1, progress: 0, rotation: 180 });
    expect(loadingFrame(0.75).progress).toBeGreaterThan(0);
  });
  it('reproduces official Material Web shadow endpoints', () => {
    expect(elevationShadows(1)).toMatchObject({
      key: '0 1px 2px 0 var(--md-sys-color-shadow, #000)',
      ambient: '0 1px 3px 1px var(--md-sys-color-shadow, #000)',
    });
    expect(elevationShadows(3).ambient).toBe('0 4px 8px 3px var(--md-sys-color-shadow, #000)');
    expect(elevationShadows(4).key).toBe('0 2px 3px 0 var(--md-sys-color-shadow, #000)');
  });
});
describe('official cubic backend and asymmetric shapes', () => {
  it('rejects invalid morph geometry before starting asynchronous work', () => {
    expect(() => createMorph('circle', 'heart', { count: 0 })).toThrow();
    expect(() => createMorph('rounded:full', 'rounded:small', { width: 0 })).toThrow();
  });
  it('loads official feature matching, then interpolates its cubic control points exactly', async () => {
    const fixture: Record<string, readonly (readonly number[])[]> = {
      'heart|circle': heartCircle,
      'softBurst|cookie9Sided': burstCookie,
      'pill|triangle': pillTriangle,
    };
    for (const [from, to] of [
      ['heart', 'circle'],
      ['softBurst', 'cookie9Sided'],
      ['pill', 'triangle'],
    ] as const) {
      const morph = createMorph(from, to);
      await morph.ready;
      expect(morph.exact).toBe(true);
      const data = fixture[`${from}|${to}`]!,
        middle = morph.cubicsAt(0.5)!;
      expect(middle.length).toBe(data[0]!.length);
      middle.forEach((v, i) => expect(v).toBeCloseTo((data[0]![i]! + data[1]![i]!) / 2, 7));
    }
  });
  it('mirrors logical asymmetric corner tokens in RTL and retains physical px radii', () => {
    const ltr = createMorph('rounded:largeStart', 'rounded:largeEnd', { width: 240, height: 40 }),
      rtl = createMorph('rounded:largeStart', 'rounded:largeEnd', {
        width: 240,
        height: 40,
        direction: 'rtl',
      });
    expect(ltr.cubicsAt(0)![0]).toBe(1);
    expect(rtl.cubicsAt(0)![0]).toBeCloseTo(224 / 240);
    const bounds = cubicControlBounds(roundedRectangleCubics(240, 40, [16, 0, 0, 16]));
    expect(bounds).toEqual({ minX: 0, minY: 0, maxX: 1, maxY: 1 });
    expect(shapeRotationScale(['pill', 'sunny'])).toBeGreaterThan(0.5);
  });
  it('renders real cubic segments and clips doubled strokes inside the geometry', () => {
    const host = document.createElement('div'),
      renderer = own(createShapeRenderer(host));
    renderer.insetStroke(2);
    renderer.drawCubics(roundedRectangleCubics(120, 40, 12));
    const path = host.querySelector('path')!;
    expect(path.getAttribute('d')).toContain('C');
    expect(path.style.strokeWidth).toBe('4px');
    expect(path.getAttribute('clip-path')).toContain('url(#eui-inset-');
  });
});
describe('direct manipulation and equivalent backend commands', () => {
  it('commits a Switch drag once and cancels its following native click', () => {
    const input = nativeInput('checkbox');
    own(enhanceSwitch(input));
    const changed = vi.fn();
    input.addEventListener('change', changed);
    function pointer(type: string, x: number, time: number) {
      const event = new PointerEvent(type, {
        pointerId: 1,
        button: 0,
        clientX: x,
        clientY: 0,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'timeStamp', { value: time });
      input.dispatchEvent(event);
    }
    pointer('pointerdown', 0, 0);
    pointer('pointermove', 20, 1000);
    pointer('pointerup', 20, 1010);
    input.dispatchEvent(new MouseEvent('click', { detail: 1, bubbles: true, cancelable: true }));
    expect(input.checked).toBe(true);
    expect(changed).toHaveBeenCalledOnce();
    frame.flush();
    expect(
      input.parentElement!.querySelector<HTMLElement>('.eui-switch-thumb')!.style.transform,
    ).toBe('translateX(20px) scale(1)');
  });
  it('returns a canceled Switch drag to the original value', () => {
    const input = nativeInput('checkbox');
    own(enhanceSwitch(input));
    input.dispatchEvent(
      new PointerEvent('pointerdown', { pointerId: 1, button: 0, clientX: 0, clientY: 0 }),
    );
    input.dispatchEvent(
      new PointerEvent('pointermove', { pointerId: 1, clientX: 18, clientY: 0, cancelable: true }),
    );
    input.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, clientX: 18 }));
    frame.flush();
    expect(input.checked).toBe(false);
    expect(
      input.parentElement!.querySelector<HTMLElement>('.eui-switch-thumb')!.style.transform,
    ).toContain('translateX(0px)');
  });
  it('emits cubic CSS shape commands when the capability is enabled', () => {
    vi.stubGlobal('CSS', { supports: () => true });
    const host = document.createElement('div'),
      renderer = own(createShapeRenderer(host, 'css-shape'));
    renderer.drawCubics(roundedRectangleCubics(120, 40, 12));
    expect(renderer.backend).toBe('css-shape');
    expect((renderer.element as HTMLElement).style.clipPath).toContain('curve to');
    expect((renderer.element as HTMLElement).style.clipPath).toContain(' with ');
  });
});
