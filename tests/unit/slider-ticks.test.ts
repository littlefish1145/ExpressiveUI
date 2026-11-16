import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  enhanceRangeSlider,
  enhanceSlider,
  enhanceVerticalSlider,
} from '@expressive-ui/components';

const controllers: { destroy(): void }[] = [];
afterEach(() => {
  controllers.splice(0).forEach((controller) => controller.destroy());
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

function setup(kind: 'single' | 'range' | 'vertical', step?: string, showTicks?: boolean) {
  let length = 240;
  let resize: ResizeObserverCallback | undefined;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  const host = document.createElement('span');
  host.getBoundingClientRect = () =>
    new DOMRect(0, 0, kind === 'vertical' ? 48 : length, kind === 'vertical' ? length : 48);
  const input = document.createElement('input');
  input.type = 'range';
  input.min = '0';
  input.max = '100';
  input.value = '40';
  if (step !== undefined) input.step = step;
  host.append(input);
  document.body.append(host);
  const options = showTicks === undefined ? {} : { showTicks };
  if (kind === 'range') {
    const end = input.cloneNode() as HTMLInputElement;
    end.value = '80';
    host.append(end);
    controllers.push(enhanceRangeSlider(input, end, options));
  } else
    controllers.push(
      kind === 'single' ? enhanceSlider(input, options) : enhanceVerticalSlider(input, options),
    );
  return {
    input,
    ticks: () => [
      ...host.querySelectorAll<SVGCircleElement>(
        '.eui-slider-active-tick, .eui-slider-inactive-tick',
      ),
    ],
    resize: (value: number) => {
      length = value;
      resize?.([{} as ResizeObserverEntry], {} as ResizeObserver);
    },
  };
}

describe.each(['single', 'range', 'vertical'] as const)('%s slider tick rendering', (kind) => {
  it('keeps default ranges and step=any free of ticks', () => {
    expect(setup(kind).ticks()).toHaveLength(0);
    expect(setup(kind, 'any', true).ticks()).toHaveLength(0);
  });
  it('spaces dense ticks by at least 12px and recalculates after resizing', () => {
    const slider = setup(kind, '.001');
    const assertSpacing = () => {
      const ticks = slider.ticks();
      expect(ticks.length).toBeGreaterThan(1);
      for (let i = 1; i < ticks.length; i++)
        expect(
          Number(ticks[i]!.getAttribute('cx')) - Number(ticks[i - 1]!.getAttribute('cx')),
        ).toBeGreaterThanOrEqual(12);
    };
    assertSpacing();
    const originalCount = slider.ticks().length;
    slider.resize(120);
    assertSpacing();
    expect(slider.ticks().length).toBeLessThan(originalCount);
    expect(slider.input.step).toBe('.001');
  });
  it('allows explicitly showing or hiding ticks', () => {
    expect(setup(kind, undefined, true).ticks().length).toBeGreaterThan(1);
    expect(setup(kind, '10', false).ticks()).toHaveLength(0);
  });
  if (kind !== 'single')
    it('places non-divisible steps at their actual values', () => {
      for (const tick of setup(kind, '30').ticks()) {
        const stepIndex = (((Number(tick.getAttribute('cx')) - 2) / 236) * 100) / 30;
        expect(stepIndex).toBeCloseTo(Math.round(stepIndex), 8);
      }
    });
});
