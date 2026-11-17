import '../../packages/components/src/styles.css';
import './style.css';
import './controls.css';
import type { mountCatalog } from './catalog.js';
import './catalog.css';
import './extensions.css';
import defaultThemes from './default-themes.json';
import { observePagePerformance } from './performance.js';
import { themePresets } from '../../packages/theme/src/presets.js';
import {
  enhanceButton,
  enhanceFab,
  enhanceSwitch,
  enhanceLoadingIndicator,
  enhanceIconButton,
  enhanceCheckbox,
  enhanceRadio,
  enhanceSlider,
} from '@epui/components';
import type { ButtonVariant, FabOptions } from '@epui/components';
import type { ButtonSize } from '@epui/tokens';
import { createThemeController } from '@epui/theme/runtime';
import type { generateTheme } from '@epui/theme';
import type { ThemeVariant, Theme } from '@epui/theme';
import { createShapeRenderer, getShape, shapeNames, createMorph } from '@epui/shape';
import type { ShapeToken, ShapeBackend } from '@epui/shape';
import {
  createSpring,
  createVectorSpring,
  motionPreset,
  sampleSpring,
} from '@epui/motion';
import {
  getMotionPreference,
  setMotionPreference,
  observeReducedMotion,
} from '@epui/motion';
import type { MotionPreference } from '@epui/motion';
import type { MotionScheme, MotionToken, SpringParameters } from '@epui/motion';
import {
  Scope,
  detectCapabilities,
  observeSize,
  mediaPreference,
  observeViewport,
} from '@epui/core';
const $ = <T extends HTMLElement>(id: string) => {
  const element = document.getElementById(id);
  if (!element) throw Error(`Missing #${id}`);
  return element as T;
};
const scope = new Scope();
const pagePerformance = observePagePerformance(scope);
// Yield between enhancement batches so native HTML can paint and handle input.
const yieldToMain = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
let catalog: Awaited<ReturnType<typeof mountCatalog>> | undefined;
const previousMotionPreference = getMotionPreference();
scope.add(() => setMotionPreference(previousMotionPreference));
let scheme: MotionScheme = 'expressive',
  token: MotionToken = 'fast.spatial';
const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-demo-button]')].map(
  (element) =>
    enhanceButton(element, {
      variant: (element.dataset.variant ?? 'filled') as ButtonVariant,
      size: (element.dataset.size ?? 'sm') as ButtonSize,
      shape: (element.dataset.shape ?? 'round') as 'round' | 'square',
    }),
);
const fabs = [...document.querySelectorAll<HTMLButtonElement>('[data-demo-fab]')].map((element) =>
  enhanceFab(element, {
    size: (element.dataset.size ?? 'regular') as NonNullable<FabOptions['size']>,
    extended: element.dataset.extended === 'true',
  }),
);
await yieldToMain();
const switches = [
  ...document.querySelectorAll<HTMLInputElement>('input[type=checkbox]:not([data-checkbox])'),
].map((element) => enhanceSwitch(element));
const indicators = [...document.querySelectorAll<HTMLElement>('[data-loading]')].map((element) =>
  enhanceLoadingIndicator(element, {
    contained: element.dataset.contained === 'true',
    label: '正在加载',
  }),
);
const iconButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-icon-button]')].map(
  (element) =>
    enhanceIconButton(element, {
      variant: (element.dataset.variant ?? 'standard') as
        'standard' | 'filled' | 'tonal' | 'outlined',
      size: (element.dataset.size ?? 'sm') as ButtonSize,
      width: (element.dataset.width ?? 'uniform') as 'narrow' | 'uniform' | 'wide',
      shape: (element.dataset.shape ?? 'round') as 'round' | 'square',
      toggle: element.dataset.toggle === 'true',
      selected: element.dataset.selected === 'true',
    }),
);
await yieldToMain();
const checkboxes = [...document.querySelectorAll<HTMLInputElement>('[data-checkbox]')].map(
  (element) => {
    element.indeterminate = element.dataset.mixed === 'true';
    return enhanceCheckbox(element);
  },
);
const radios = [...document.querySelectorAll<HTMLInputElement>('[data-radio]')].map((element) =>
  enhanceRadio(element),
);
const sliders = [...document.querySelectorAll<HTMLInputElement>('input[type=range]')]
  .filter((element) => !element.closest('#component-catalog'))
  .map((element) => {
    if (!element.hasAttribute('data-slider')) {
      const wrapper = document.createElement('span');
      wrapper.className = 'lab-range';
      element.before(wrapper);
      wrapper.append(element);
      scope.add(() => wrapper.replaceWith(element));
    }
    return enhanceSlider(element, {
      showTicks: element.id === 'slider-steps',
      ...(element.id === 'slider-volume'
        ? { formatValue: (v: number) => `${Math.round(v)}%` }
        : {}),
    });
  });
for (const controller of [
  ...buttons,
  ...fabs,
  ...switches,
  ...indicators,
  ...iconButtons,
  ...checkboxes,
  ...radios,
  ...sliders,
])
  scope.add(() => controller.destroy());
const allCheckbox = checkboxes.find((c) => c.element.id === 'checkbox-all')!;
const childCheckboxes = checkboxes.filter((c) =>
  ['checkbox-design', 'checkbox-motion'].includes(c.element.id),
);
scope.listen(allCheckbox.element, 'change', () => {
  for (const c of childCheckboxes)
    c.setState(allCheckbox.element.checked ? 'checked' : 'unchecked');
});
for (const c of childCheckboxes)
  scope.listen(c.element, 'change', () => {
    const count = childCheckboxes.filter((c) => c.element.checked).length;
    allCheckbox.setState(
      count === 0 ? 'unchecked' : count === childCheckboxes.length ? 'checked' : 'mixed',
    );
  });
for (const [input, output] of [
  ['slider-volume', 'volume-value'],
  ['slider-steps', 'steps-value'],
])
  scope.listen($(input!), 'input', () => {
    $(output!).textContent =
      $<HTMLInputElement>(input!).value + (input === 'slider-volume' ? '%' : '');
  });
let seed = '#6750a4',
  variant: ThemeVariant = 'tonal-spot',
  contrast = 0;
let colorModule: Promise<typeof import('@epui/theme')> | undefined;
const computeTheme: typeof generateTheme extends (...args: infer A) => infer R
  ? (...args: A) => Promise<R>
  : never = async (...args) => {
  colorModule ??= import('@epui/theme');
  return (await colorModule).generateTheme(...args);
};
let themes: { light: Theme; dark: Theme } = {
  light: defaultThemes.light,
  dark: defaultThemes.dark,
};
const presetControllers = new Map<string, ReturnType<typeof enhanceButton>>();
const presetPreviews = new Map<string, ReturnType<typeof generateTheme>>(
  Object.entries(defaultThemes.previews),
);
for (const preset of themePresets) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'preset-card';
  button.dataset.preset = preset.id;
  const preview = document.createElement('span');
  preview.className = 'preset-colors';
  preview.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 3; i++) preview.append(document.createElement('span'));
  const label = document.createElement('span');
  label.className = 'preset-name';
  label.textContent = preset.name;
  button.append(preview, label);
  $('theme-presets').append(button);
  const controller = enhanceButton(button, {
    variant: 'outlined',
    toggle: true,
    selected: preset.id === 'iris',
  });
  presetControllers.set(preset.id, controller);
  buttons.push(controller);
  scope.add(() => controller.destroy());
  scope.listen(button, 'click', () => {
    seed = preset.seed;
    variant = preset.variant;
    $<HTMLInputElement>('seed').value = seed;
    $<HTMLSelectElement>('color-variant').value = variant;
    $('seed-value').textContent = seed.toUpperCase();
    for (const [id, controller] of presetControllers)
      controller.update({ selected: id === preset.id });
    catalog?.refreshSelects();
    updateTheme();
  });
}
const theme = createThemeController(document.documentElement, themes, 'system');
scope.add(() => theme.destroy());
const dark = $<HTMLInputElement>('dark-mode');
dark.checked = document.documentElement.dataset.theme === 'dark';
switches[0]?.refresh();
let swatchRequest = 0;
async function updateSwatches() {
  const request = ++swatchRequest;
  $('mode-label').textContent =
    document.documentElement.dataset.theme === 'dark' ? 'Dark' : 'Light';
  const palette = themes[document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'];
  for (const preset of themePresets) {
    const controller = presetControllers.get(preset.id)!;
    controller.update({
      selected: seed.toLowerCase() === preset.seed && variant === preset.variant,
    });
    const dark = document.documentElement.dataset.theme === 'dark',
      key = `${preset.id}|${dark}|${contrast}`;
    let preview = presetPreviews.get(key);
    if (!preview) {
      await yieldToMain();
      if (scope.disposed || request !== swatchRequest) return;
      preview = await computeTheme({ seed: preset.seed, variant: preset.variant, dark, contrast });
      if (scope.disposed || request !== swatchRequest) return;
      presetPreviews.set(key, preview);
      if (presetPreviews.size > 64) presetPreviews.delete(presetPreviews.keys().next().value!);
    }
    const colors = [
      preview.colors.primary,
      preview.colors.primaryContainer,
      preview.colors.tertiaryContainer,
    ];
    controller.element.querySelectorAll<HTMLElement>('.preset-colors>span').forEach((el, index) => {
      el.style.background = colors[index]!;
    });
  }
  const roles = [
    ['primary', 'onPrimary', 'Primary'],
    ['primaryContainer', 'onPrimaryContainer', 'Primary container'],
    ['secondary', 'onSecondary', 'Secondary'],
    ['tertiary', 'onTertiary', 'Tertiary'],
    ['surfaceContainerHigh', 'onSurface', 'Surface'],
    ['inverseSurface', 'inverseOnSurface', 'Inverse'],
  ] as const;
  $('swatches').replaceChildren(
    ...roles.map(([bg, fg, name]) => {
      const el = document.createElement('div');
      el.className = 'swatch';
      el.style.background = palette.colors[bg];
      el.style.color = palette.colors[fg];
      const label = document.createElement('strong');
      label.textContent = name;
      const hex = document.createElement('small');
      hex.textContent = palette.colors[bg].toUpperCase();
      el.append(label, hex);
      return el;
    }),
  );
}
scope.listen(dark, 'change', () => {
  theme.setMode(dark.checked ? 'dark' : 'light');
  updateSwatches();
});
const systemDark = mediaPreference('(prefers-color-scheme: dark)', () => {
  if (theme.mode === 'system') {
    dark.checked = document.documentElement.dataset.theme === 'dark';
    switches[0]?.refresh();
    updateSwatches();
  }
});
scope.add(() => systemDark.destroy());
let themeRequest = 0;
async function updateTheme() {
  const request = ++themeRequest;
  const next = { seed, variant, contrast };
  const light = await computeTheme(next);
  await yieldToMain();
  const dark = await computeTheme({ ...next, dark: true });
  if (scope.disposed || request !== themeRequest) return;
  themes = { light, dark };
  theme.setThemes(themes);
  updateSwatches();
  $('seed-value').textContent = seed.toUpperCase();
}
let seedTimer: ReturnType<typeof setTimeout> | undefined;
scope.add(() => clearTimeout(seedTimer));
scope.listen($('seed'), 'input', () => {
  seed = $<HTMLInputElement>('seed').value;
  ++themeRequest;
  clearTimeout(seedTimer);
  seedTimer = setTimeout(() => void updateTheme(), 80);
});
scope.listen($('color-variant'), 'change', () => {
  variant = $<HTMLSelectElement>('color-variant').value as ThemeVariant;
  updateTheme();
});
scope.listen($('contrast'), 'change', () => {
  contrast = Number($<HTMLSelectElement>('contrast').value);
  updateTheme();
});
updateSwatches();
const heroRenderer = createShapeRenderer($('hero-shape'));
heroRenderer.draw(getShape('softBurst', 100, 100, 256));
scope.add(() => heroRenderer.destroy());
const from = $<HTMLSelectElement>('shape-from'),
  to = $<HTMLSelectElement>('shape-to');
for (const select of [from, to])
  for (const name of [
    ...shapeNames,
    'rounded:small',
    'rounded:medium',
    'rounded:large',
    'rounded:full',
  ]) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name.replace(/([A-Z])/g, ' $1').replace('rounded:', 'Rounded · ');
    select.append(option);
  }
from.value = 'circle';
to.value = 'softBurst';
let renderer = createShapeRenderer($('morph-shape'));
let pair = createMorph('rounded:full', 'rounded:full', { count: 256 });
// Official geometry can load without blocking the rest of the page setup.
let progress = 0,
  morphTarget = 1,
  paused = false;
let parameters: SpringParameters = { ...motionPreset(scheme, token), initialVelocity: 0 };
const scrub = $<HTMLInputElement>('scrub');
let bridge: ReturnType<typeof createVectorSpring> | undefined;
const correctedPoints = new Float64Array(512);
const orderedBuffer = new Float64Array(512);
let pairPhase = 0;
function orderedPoints(value: number) {
  const points = pair.at(value);
  if (!pairPhase) return points;
  for (let i = 0; i < 256; i++) {
    const j = (i + pairPhase) % 256;
    orderedBuffer[i * 2] = points[j * 2]!;
    orderedBuffer[i * 2 + 1] = points[j * 2 + 1]!;
  }
  return orderedBuffer;
}
scope.add(() => bridge?.destroy());
function render(value: number) {
  progress = value;
  if (bridge && bridge.value.some((value) => value !== 0)) {
    const base = orderedPoints(value);
    for (let i = 0; i < base.length; i++) correctedPoints[i] = base[i]! + bridge.value[i]!;
    renderer.draw(correctedPoints);
  } else {
    const cubics = pair.cubicsAt(value);
    if (cubics) renderer.drawCubics(cubics);
    else renderer.draw(pair.at(value));
  }
  $('progress-label').textContent = value.toFixed(3);
  scrub.value = String(Math.min(1, Math.max(0, value)));
  $('scrub-output').textContent = Math.round(value * 100) + '%';
}
const spring = createSpring(0, render, parameters);
scope.add(() => spring.destroy());
let morphRequest = 0;
let morphInitialized = false;
function geometryState() {
  const positions = orderedPoints(progress).slice();
  const ahead = orderedPoints(progress + 0.0001);
  const velocities = new Float64Array(positions.length);
  for (let i = 0; i < positions.length; i++) {
    velocities[i] =
      ((ahead[i]! - positions[i]!) / 0.0001) * spring.velocity + (bridge?.velocity[i] ?? 0);
    positions[i] = positions[i]! + (bridge?.value[i] ?? 0);
  }
  return { positions, velocities };
}
async function rebuild(animate = false) {
  morphInitialized = true;
  const request = ++morphRequest;
  const box = $('morph-shape').getBoundingClientRect();
  const nextPair = createMorph(from.value as ShapeToken, to.value as ShapeToken, {
    width: box.width || 210,
    height: box.height || 210,
    count: 256,
  });
  $<HTMLButtonElement>('morph-action').disabled = true;
  await nextPair.ready;
  if (scope.disposed || request !== morphRequest) return;
  const previous = geometryState();
  bridge?.destroy();
  bridge = undefined;
  pair = nextPair;
  // Match the new pair's vertex phase without resampling the live position or velocity.
  const destination = pair.at(progress);
  let cost = Infinity;
  pairPhase = 0;
  for (let phase = 0; phase < 256; phase++) {
    let candidate = 0;
    for (let i = 0; i < 256; i++) {
      const j = (i + phase) % 256;
      candidate +=
        (previous.positions[i * 2]! - destination[j * 2]!) ** 2 +
        (previous.positions[i * 2 + 1]! - destination[j * 2 + 1]!) ** 2;
      if (candidate > cost) break;
    }
    if (candidate < cost) {
      cost = candidate;
      pairPhase = phase;
    }
  }
  const next = geometryState();
  const offset = previous.positions.map((value, i) => value - next.positions[i]!);
  bridge = createVectorSpring(offset, () => render(progress), motionPreset(scheme, 'fast.effects'));
  for (let i = 0; i < offset.length; i++)
    bridge.velocity[i] = previous.velocities[i]! - next.velocities[i]!;
  bridge.setTarget(new Float64Array(offset.length));
  if (paused) bridge.pause();
  $<HTMLButtonElement>('morph-action').disabled = false;
  $('shape-caption').textContent = from.value + ' → ' + to.value;
  render(progress);
  if (animate) {
    if (!paused) spring.play();
    spring.setTarget(1);
    morphTarget = 0;
  }
}
for (const select of [from, to])
  scope.listen(select, 'change', () => {
    morphTarget = 1;
    void rebuild(true);
  });
scope.listen($('backend'), 'change', () => {
  renderer.destroy();
  renderer = createShapeRenderer(
    $('morph-shape'),
    $<HTMLSelectElement>('backend').value as ShapeBackend,
  );
  $('backend-status').textContent = renderer.backend.toUpperCase();
  render(progress);
});
scope.add(() => renderer.destroy());
scope.listen(scrub, 'input', () => {
  bridge?.destroy();
  bridge = undefined;
  spring.jump(Number(scrub.value));
  morphTarget = progress > 0.5 ? 0 : 1;
});
scope.listen($('aspect'), 'input', () => {
  const ratio = Number($<HTMLInputElement>('aspect').value);
  $('morph-shape').style.width = `${Math.min(280, 210 * ratio)}px`;
  $('morph-shape').style.height = `${Math.min(280, 210 / Math.max(1, ratio))}px`;
  $('ratio-output').textContent = ratio.toFixed(1) + ' : 1';
  rebuild();
});
const morphViewport = observeViewport($('morph-shape'), (visible) => {
  if (visible && !morphInitialized) void rebuild();
});
scope.add(() => morphViewport.destroy());
const sizeObserver = observeSize($('morph-shape'), () => {
  if (morphViewport.visible) void rebuild();
  else morphInitialized = false;
});
scope.add(() => sizeObserver.destroy());
scope.listen($('morph-action'), 'click', () => {
  spring.setTarget(
    morphTarget,
    spring.running ? undefined : { initialVelocity: parameters.initialVelocity ?? 0 },
  );
  morphTarget = morphTarget === 1 ? 0 : 1;
});
scope.listen($('swap-shapes'), 'click', () => {
  const previous = from.value;
  from.value = to.value;
  to.value = previous;
  catalog?.refreshSelects();
  morphTarget = 1;
  void rebuild(true);
});
function plot() {
  const samples = sampleSpring(0, 1, parameters).samples;
  const duration = samples.at(-1)!.time;
  $('plot-line').setAttribute(
    'd',
    samples
      .map(
        (s, i) =>
          `${i ? 'L' : 'M'}${(s.offset * 600).toFixed(2)},${(150 - s.value * 100).toFixed(2)}`,
      )
      .join(' '),
  );
  $('settle-time').textContent = `${Math.round(duration * 1000)} ms · mass = 1`;
  $('stiffness-output').textContent = String(parameters.stiffness);
  $('damping-output').textContent = parameters.dampingRatio.toFixed(2);
  $('velocity-output').textContent = (parameters.initialVelocity ?? 0).toFixed(1);
  $('motion-description').textContent =
    scheme.toUpperCase() + ' · ' + token.replace('.', ' ').toUpperCase();
}
function applyPreset() {
  parameters = {
    ...motionPreset(scheme, token),
    initialVelocity: Number($<HTMLInputElement>('velocity').value),
  };
  $<HTMLInputElement>('stiffness').value = String(parameters.stiffness);
  $<HTMLInputElement>('damping').value = String(parameters.dampingRatio);
  spring.configure(parameters);
  bridge?.configure(motionPreset(scheme, 'fast.effects'));
  for (const component of [
    ...buttons,
    ...fabs,
    ...switches,
    ...iconButtons,
    ...checkboxes,
    ...radios,
    ...sliders,
  ])
    component.update({ motionScheme: scheme });
  plot();
}
scope.listen($('motion-scheme'), 'change', () => {
  scheme = $<HTMLSelectElement>('motion-scheme').value as MotionScheme;
  catalog?.setMotionScheme(scheme);
  applyPreset();
});
scope.listen($('motion-token'), 'change', () => {
  token = $<HTMLSelectElement>('motion-token').value as MotionToken;
  applyPreset();
});
for (const id of ['stiffness', 'damping', 'velocity'])
  scope.listen($(id), 'input', () => {
    parameters = {
      stiffness: Number($<HTMLInputElement>('stiffness').value),
      dampingRatio: Number($<HTMLInputElement>('damping').value),
      initialVelocity: Number($<HTMLInputElement>('velocity').value),
    };
    spring.configure(parameters);
    plot();
  });
scope.listen($('pause-all'), 'click', () => {
  paused = !paused;
  for (const indicator of indicators)
    if (paused) indicator.pause();
    else indicator.play();
  if (paused) {
    spring.pause();
    bridge?.pause();
  } else {
    spring.play();
    bridge?.play();
  }
  const label = $('pause-all').querySelector('.eui-content')!;
  label.textContent = paused ? 'Resume' : 'Pause';
});
scope.listen($('replay-all'), 'click', () => {
  bridge?.destroy();
  bridge = undefined;
  for (const indicator of indicators) indicator.replay();
  spring.jump(0);
  spring.play();
  spring.setTarget(1, { initialVelocity: parameters.initialVelocity ?? 0 });
  morphTarget = 0;
  paused = false;
  $('pause-all').querySelector('.eui-content')!.textContent = 'Pause';
});
scope.listen($('explore'), 'click', () =>
  $('components').scrollIntoView({
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  }),
);
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-focus]'))
  scope.listen(button, 'click', () => $(button.dataset.focus!).scrollIntoView({ block: 'center' }));
const capabilities = detectCapabilities();
for (const [name, supported] of Object.entries(capabilities)) {
  const el = document.createElement('span');
  el.className = 'capability';
  el.dataset.supported = String(supported);
  el.textContent = (supported ? '✓ ' : '○ ') + name;
  $('capabilities').append(el);
}
let toastTimer: ReturnType<typeof setTimeout> | undefined;
for (const button of document.querySelectorAll<HTMLButtonElement>(
  '.button-demo button:not(:disabled),[data-demo-fab]',
))
  scope.listen(button, 'click', () => {
    clearTimeout(toastTimer);
    $('toast').textContent = 'A small action. A little expression.';
    toastTimer = setTimeout(() => ($('toast').textContent = ''), 2200);
  });
scope.add(() => clearTimeout(toastTimer));
plot();
render(0);
function updateMotionStatus() {
  const disabled = motionPreference.matches;
  $('motion-status-title').textContent = disabled ? '当前为减少动态效果模式' : '完整动效正在运行';
  $('motion-status-detail').textContent = motionPreference.systemMatches
    ? disabled
      ? '系统报告 prefers-reduced-motion: reduce，组件按无障碍偏好保持静态。可以显式选择完整演示。'
      : '已为本次演示显式启用动效；系统仍启用减少动态效果。'
    : disabled
      ? '你选择了减少动态效果。'
      : '组件按官方动效响应交互。Slider拖动保持与指针同步。';
  $<HTMLSelectElement>('motion-preference').value = getMotionPreference();
  catalog?.refreshSelects();
}
const motionPreference = observeReducedMotion(updateMotionStatus);
scope.add(() => motionPreference.destroy());
scope.listen($('motion-preference'), 'change', () => {
  setMotionPreference($<HTMLSelectElement>('motion-preference').value as MotionPreference);
  updateMotionStatus();
});
scope.listen($('enable-motion'), 'click', () => {
  setMotionPreference('full');
  updateMotionStatus();
  for (const indicator of indicators) indicator.replay();
  spring.jump(0);
  spring.play();
  spring.setTarget(1);
});
updateMotionStatus();
scope.listen(document, 'visibilitychange', () => {
  updateMotionStatus();
  if (document.hidden)
    $('motion-status-detail').textContent = '页面位于后台，动效调度已暂停；回到当前标签页后恢复。';
});
// Public, read-only diagnostics for manual QA and optional Playwright assertions.
let catalogLoading = false;
async function loadCatalog() {
  if (catalogLoading || scope.disposed) return;
  catalogLoading = true;
  try {
    const module = await import('./catalog.js');
    await yieldToMain();
    if (scope.disposed) return;
    catalog = await module.mountCatalog(scope);
    if (scheme !== 'expressive') catalog.setMotionScheme(scheme);
    catalogObserver?.disconnect();
  } catch (error) {
    catalogLoading = false;
    console.error('Unable to load component catalog', error);
  }
}
const catalogSection = $('component-catalog');
const catalogObserver =
  typeof IntersectionObserver === 'undefined'
    ? undefined
    : new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) void loadCatalog();
        },
        { rootMargin: '800px' },
      );
catalogObserver?.observe(catalogSection);
if (!catalogObserver) void loadCatalog();
scope.add(() => catalogObserver?.disconnect());
// Keyboard focus or a direct interaction also hydrates the visible static catalog.
scope.listen(catalogSection, 'focusin', () => void loadCatalog());
scope.listen(catalogSection, 'pointerover', () => void loadCatalog(), { passive: true });
Object.defineProperty(window, 'expressive', {
  configurable: true,
  value: {
    capabilities,
    auditAccessibility: runAccessibilityAudit,
    get performance() {
      return pagePerformance();
    },
    get progress() {
      return progress;
    },
    get backend() {
      return renderer.backend;
    },
    get shape() {
      return [...geometryState().positions];
    },
    get shapeState() {
      const state = geometryState();
      return {
        points: [...state.positions],
        velocity: [...state.velocities],
        progress,
        scalarVelocity: spring.velocity,
      };
    },
    pause() {
      bridge?.pause();
      catalog?.pause();
      for (const indicator of indicators) indicator.pause();
      spring.pause();
    },
    destroy() {
      scope.dispose();
    },
  },
});
async function runAccessibilityAudit() {
  await loadCatalog();
  while (catalogLoading && !catalog && !scope.disposed)
    await new Promise((resolve) => setTimeout(resolve, 20));
  if (scope.disposed || !catalog) throw Error('Catalog is not ready');
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  return (await import('./accessibility.js')).auditAccessibility();
}
scope.listen(
  $('audit-accessibility'),
  'click',
  () =>
    void (async () => {
      const button = $<HTMLButtonElement>('audit-accessibility');
      button.disabled = true;
      $('audit-status').textContent = '正在检查…';
      try {
        const result = await runAccessibilityAudit();
        if (scope.disposed) return;
        $('audit-result').hidden = false;
        $('audit-result').textContent = JSON.stringify(result, null, 2);
        $('audit-status').textContent =
          `${result.violations.length} 类确定问题，${result.incomplete.length} 类需人工确认。`;
      } catch (error) {
        if (!scope.disposed) $('audit-status').textContent = String(error);
      } finally {
        if (!scope.disposed) button.disabled = false;
      }
    })(),
);
scope.listen(window, 'pagehide', (event) => {
  if (!(event as PageTransitionEvent).persisted) scope.dispose();
});
if (import.meta.hot) import.meta.hot.dispose(() => scope.dispose());
