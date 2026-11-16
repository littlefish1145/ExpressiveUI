import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  solveSpring,
  sampleSpring,
  motionPreset,
  createSpring,
  activeAnimationCount,
  animateSpring,
} from '@amiracle1024/motion';
const parameters = { stiffness: 380, dampingRatio: 0.8 };
afterEach(() => vi.unstubAllGlobals());
describe('mass-normalized analytical spring', () => {
  it('honors displacement and initial velocity at t=0', () => {
    expect(solveSpring(2, 8, -3, 0, parameters)).toEqual({ value: 2, velocity: -3 });
    const near = solveSpring(2, 8, -3, 1e-6, parameters);
    expect((near.value - 2) / 1e-6).toBeCloseTo(-3, 2);
  });
  it('matches the closed-form critically damped reference', () => {
    const k = 100,
      t = 0.2;
    const p = solveSpring(0, 1, 0, t, { stiffness: k, dampingRatio: 1 });
    expect(p.value).toBeCloseTo(1 - (1 + 10 * t) * Math.exp(-10 * t), 12);
    expect(p.velocity).toBeCloseTo(100 * t * Math.exp(-10 * t), 12);
  });
  it.each([0.6, 1, 2, 100])('has frame partition invariance at damping %s', (dampingRatio) => {
    const p = { stiffness: 800, dampingRatio },
      full = solveSpring(0, 1, 2, 0.7, p);
    let state = { value: 0, velocity: 2 };
    for (let i = 0; i < 168; i++) state = solveSpring(state.value, 1, state.velocity, 0.7 / 168, p);
    expect(state.value).toBeCloseTo(full.value, 10);
    expect(state.velocity).toBeCloseTo(full.velocity, 10);
  });
  it('conserves undamped spring energy', () => {
    for (const t of [0, 0.1, 1, 3]) {
      const p = solveSpring(0, 1, 2, t, { stiffness: 100, dampingRatio: 0 });
      expect(0.5 * p.velocity ** 2 + 50 * (p.value - 1) ** 2).toBeCloseTo(52, 8);
    }
  });
  it('has overshoot for expressive spatial and no overshoot for effects', () => {
    expect(
      Math.max(
        ...sampleSpring(0, 1, motionPreset('expressive', 'fast.spatial')).samples.map(
          (s) => s.value,
        ),
      ),
    ).toBeGreaterThan(1.05);
    for (const scheme of ['expressive', 'standard'] as const)
      for (const token of ['fast.effects', 'default.effects', 'slow.effects'] as const)
        expect(
          Math.max(...sampleSpring(0, 1, motionPreset(scheme, token)).samples.map((s) => s.value)),
        ).toBe(1);
  });
  it('uses official scheme values', () => {
    expect(motionPreset('standard', 'fast.spatial')).toEqual({
      stiffness: 1400,
      dampingRatio: 0.9,
    });
    expect(motionPreset('expressive', 'slow.spatial')).toEqual({
      stiffness: 200,
      dampingRatio: 0.8,
    });
  });
  it('is deterministic and samples offset endpoints', () => {
    const a = sampleSpring(0, 1, parameters),
      b = sampleSpring(0, 1, parameters);
    expect(a).toEqual(b);
    expect(a.samples[0]?.offset).toBe(0);
    expect(a.samples.at(-1)).toMatchObject({ value: 1, velocity: 0, offset: 1 });
  });
  it('rejects invalid physics and a non-settling fixed animation', () => {
    expect(() => solveSpring(0, 1, 0, 1, { stiffness: 0, dampingRatio: 1 })).toThrow();
    expect(() => solveSpring(0, 1, 0, -1, parameters)).toThrow();
    expect(() =>
      sampleSpring(0, 1, { stiffness: 100, dampingRatio: 0 }, { maxDuration: 1 }),
    ).toThrow();
  });
});
function frames() {
  const pending = new Map<number, FrameRequestCallback>();
  let id = 0,
    now = 0;
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    pending.set(++id, fn);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => pending.delete(key));
  return {
    step(ms = 1000 / 60) {
      now += ms;
      const callbacks = [...pending.values()];
      pending.clear();
      for (const fn of callbacks) fn(now);
    },
    pending,
  };
}
describe('interactive runtime resource ownership', () => {
  it('preserves velocity across interruption and reversal', () => {
    const clock = frames(),
      spring = createSpring(0, () => {}, parameters);
    spring.setTarget(1);
    for (let i = 0; i < 8; i++) clock.step();
    const before = spring.velocity;
    expect(before).toBeGreaterThan(0);
    spring.setTarget(0);
    expect(spring.velocity).toBe(before);
    for (let i = 0; i < 120; i++) clock.step();
    expect(spring.value).toBe(0);
    expect(activeAnimationCount()).toBe(0);
    spring.destroy();
  });
  it('handles 100 rapid target changes with one scheduler task', () => {
    const clock = frames(),
      spring = createSpring(0, () => {}, parameters);
    for (let i = 0; i < 100; i++) {
      spring.setTarget(i % 2);
      clock.step();
      expect(activeAnimationCount()).toBeLessThanOrEqual(1);
    }
    spring.destroy();
    expect(clock.pending.size).toBe(0);
    expect(activeAnimationCount()).toBe(0);
  });
  it('pauses, resumes and discards suspension gaps', () => {
    const clock = frames(),
      spring = createSpring(0, () => {}, parameters);
    spring.setTarget(1);
    clock.step();
    clock.step();
    const before = spring.value;
    clock.step(60000);
    expect(spring.value).toBe(before);
    spring.pause();
    clock.step(500);
    expect(spring.value).toBe(before);
    spring.play();
    for (let i = 0; i < 120; i++) clock.step();
    expect(spring.value).toBe(1);
    spring.destroy();
  });
  it('honors explicit reduced motion without scheduling', () => {
    frames();
    const render = vi.fn(),
      spring = createSpring(0, render, { ...parameters, reducedMotion: true });
    spring.setTarget(1);
    expect(spring.value).toBe(1);
    expect(spring.velocity).toBe(0);
    expect(activeAnimationCount()).toBe(0);
    spring.destroy();
  });
  it('releases live preference listeners and ignores post-destroy targets', () => {
    frames();
    const media = new EventTarget() as MediaQueryList;
    Object.defineProperty(media, 'matches', { value: false, writable: true });
    const remove = vi.spyOn(media, 'removeEventListener');
    vi.stubGlobal('matchMedia', () => media);
    const spring = createSpring(0, () => {}, parameters);
    spring.setTarget(1);
    Object.defineProperty(media, 'matches', { value: true });
    media.dispatchEvent(new Event('change'));
    expect(spring.value).toBe(1);
    spring.destroy();
    spring.setTarget(3);
    expect(remove).toHaveBeenCalledWith('change', expect.any(Function));
    expect(activeAnimationCount()).toBe(0);
    expect(spring.value).toBe(1);
  });
  it('samples WAAPI from the same solver and cleans cancellation', async () => {
    const el = document.createElement('div');
    let resolve: () => void = () => {};
    const animation = {
      pause: vi.fn(),
      play: vi.fn(),
      cancel: vi.fn(),
      currentTime: 100,
      finished: new Promise<void>((r) => {
        resolve = r;
      }),
    };
    const animate = vi.fn(() => animation);
    Object.defineProperty(el, 'animate', { value: animate });
    const handle = animateSpring(el, (v) => ({ transform: `translateX(${v}px)` }), {
      ...parameters,
      from: 0,
      to: 100,
    });
    expect(animate).toHaveBeenCalledOnce();
    expect(handle.value).toBeCloseTo(solveSpring(0, 100, 0, 0.1, parameters).value, 10);
    resolve();
    expect(await handle.finished).toBe(true);
    expect(el.style.transform).toBe('translateX(100px)');
    expect(animation.cancel).toHaveBeenCalled();
  });
});
