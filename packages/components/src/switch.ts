import { bindPress } from '@epui/core';
import { createSpring, motionPreset } from '@epui/motion';
import type { MotionScheme } from '@epui/motion';
import { getShape, createShapeRenderer } from '@epui/shape';
import { mount, decoration } from './shared.js';
import { animateColors } from './animated-styles.js';
import { bindRipple } from './ripple.js';
export interface SwitchOptions {
  motionScheme?: MotionScheme;
}
/** Enhance an existing checkbox inside a dedicated .eui-switch label/span. */
export function enhanceSwitch(input: HTMLInputElement, initial: SwitchOptions = {}) {
  if (input.type !== 'checkbox') throw new TypeError('Switch requires input[type=checkbox]');
  if (!input.parentElement) throw new TypeError('Switch checkbox requires a wrapper');
  const host: HTMLElement = input.parentElement;
  const scope = mount(input, 'eui-switch-input', ['role']);
  input.setAttribute('role', 'switch');
  const hostHadClass = host.classList.contains('eui-switch');
  host.classList.add('eui-switch');
  scope.add(() => {
    if (!hostHadClass) host.classList.remove('eui-switch');
  });
  let options = { ...initial },
    pressed = false;
  const track = decoration('eui-switch-track'),
    thumb = decoration('eui-switch-thumb');
  track.append(thumb);
  input.after(track);
  scope.add(() => track.remove());
  const renderer = createShapeRenderer(thumb);
  renderer.draw(getShape('rounded:full', 24, 24));
  scope.add(() => renderer.destroy());
  const ripple = bindRipple(input, thumb, { bounded: false, radius: 20 });
  scope.add(() => ripple.destroy());
  const colors = animateColors(
    input,
    [
      { element: track, property: 'background-color' },
      { element: track, property: 'border-color' },
      { element: thumb, property: 'color' },
    ],
    options.motionScheme,
  );
  scope.add(() => colors.destroy());
  let position = input.checked ? 1 : 0,
    scale = input.checked ? 1 : 2 / 3,
    rtl = getComputedStyle(host).direction === 'rtl';
  function draw() {
    // Center positions 16→36; transform only, no per-frame width/layout changes.
    thumb.style.transform = `translateX(${(rtl ? -1 : 1) * (position * 20)}px) scale(${scale})`;
    thumb.style.setProperty('--_state-scale', String(1 / Math.max(0.1, Math.abs(scale))));
  }
  const movement = createSpring(
    position,
    (value) => {
      position = value;
      draw();
    },
    motionPreset(options.motionScheme, 'fast.spatial'),
  );
  const expansion = createSpring(
    scale,
    (value) => {
      scale = value;
      draw();
    },
    motionPreset(options.motionScheme, 'fast.spatial'),
  );
  scope.add(() => {
    movement.destroy();
    expansion.destroy();
  });
  function refresh(animate = true) {
    if (scope.disposed) return;
    rtl = getComputedStyle(host).direction === 'rtl';
    const next = input.checked ? 1 : 0,
      nextScale = pressed ? 28 / 24 : input.checked ? 1 : 16 / 24;
    if (animate) {
      movement.setTarget(next);
      expansion.setTarget(nextScale);
    } else {
      movement.jump(next);
      expansion.jump(nextScale);
    }
    colors.refresh(animate);
  }
  scope.listen(input, 'change', () => {
    refresh();
    queueMicrotask(() => {
      if (!scope.disposed) refresh();
    });
  });
  const form = input.form;
  if (form)
    scope.listen(form, 'reset', (event) => {
      queueMicrotask(() => {
        if (!scope.disposed && !event.defaultPrevented) refresh(false);
      });
    });
  scope.add(
    bindPress(input, (state) => {
      pressed = state.pressed;
      refresh();
    }),
  );
  let drag:
      | {
          pointer: number;
          x: number;
          y: number;
          initial: number;
          lastX: number;
          lastTime: number;
          velocity: number;
          active: boolean;
        }
      | undefined,
    suppressClick = false;
  scope.listen(input, 'pointerdown', (event) => {
    const e = event as PointerEvent;
    if (e.button !== 0 || input.matches(':disabled')) return;
    suppressClick = false;
    drag = {
      pointer: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      initial: movement.value,
      lastX: e.clientX,
      lastTime: e.timeStamp,
      velocity: 0,
      active: false,
    };
  });
  scope.listen(input, 'pointermove', (event) => {
    const e = event as PointerEvent;
    if (!drag || e.pointerId !== drag.pointer || input.matches(':disabled')) return;
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    if (!drag.active) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
        drag = undefined;
        return;
      }
      if (Math.abs(dx) < 8) return;
      drag.active = true;
    }
    if (e.cancelable) e.preventDefault();
    const dt = (e.timeStamp - drag.lastTime) / 1000;
    if (dt > 0) drag.velocity = ((e.clientX - drag.lastX) / 20 / dt) * (rtl ? -1 : 1);
    drag.lastX = e.clientX;
    drag.lastTime = e.timeStamp;
    movement.jump(Math.max(0, Math.min(1, drag.initial + (rtl ? -dx : dx) / 20)));
  });
  const endDrag = (event: Event) => {
    const e = event as PointerEvent;
    if (!drag || e.pointerId !== drag.pointer) return;
    const current = drag;
    drag = undefined;
    if (!current.active) return;
    if (e.type === 'pointercancel' || input.matches(':disabled')) {
      refresh();
      return;
    }
    const next = Math.abs(current.velocity) > 6.25 ? current.velocity > 0 : movement.value >= 0.5;
    const changed = input.checked !== next;
    input.checked = next;
    suppressClick = true;
    movement.setTarget(next ? 1 : 0, { initialVelocity: current.velocity });
    expansion.setTarget(next ? 1 : 16 / 24);
    colors.refresh();
    if (changed) {
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };
  scope.listen(input, 'pointerup', endDrag);
  scope.listen(input, 'pointercancel', endDrag);
  scope.listen(input, 'click', (event) => {
    if (suppressClick && (event as MouseEvent).detail !== 0) {
      event.preventDefault();
      suppressClick = false;
      queueMicrotask(() => refresh());
    }
  });
  scope.add(() => {
    drag = undefined;
  });
  const observer = new MutationObserver(() => refresh());
  observer.observe(input, { attributes: true, attributeFilter: ['checked', 'disabled', 'dir'] });
  scope.add(() => observer.disconnect());
  refresh(false);
  return {
    element: input,
    refresh() {
      if (!scope.disposed) refresh();
    },
    setChecked(checked: boolean, { notify = false }: { notify?: boolean } = {}) {
      if (scope.disposed) return;
      const changed = input.checked !== checked;
      input.checked = checked;
      refresh();
      if (changed && notify) {
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    },
    update(next: SwitchOptions) {
      if (scope.disposed) return;
      options = { ...options, ...next };
      movement.configure(motionPreset(options.motionScheme, 'fast.spatial'));
      expansion.configure(motionPreset(options.motionScheme, 'fast.spatial'));
      colors.configure(options.motionScheme ?? 'expressive');
      colors.refresh();
    },
    destroy() {
      scope.dispose();
    },
  };
}
