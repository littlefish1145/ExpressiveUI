import { createSpring, motionPreset } from '@epui/motion';
import type { MotionScheme } from '@epui/motion';
import { mount } from './shared.js';
import { uniqueId, rovingFocus } from './collection.js';
import { enhanceDialog } from './dialog.js';
import { enhanceButton } from './button.js';
import { enhanceIconButton } from './icon-button.js';
import { interactive } from './interactive.js';
import { controlIcon } from './svg.js';
export interface TimePickerOptions {
  format?: 12 | 24;
  mode?: 'dial' | 'input';
  label?: string;
  motionScheme?: MotionScheme;
}
export function parseTime(value: string): { hour: number; minute: number } | null {
  const m = value.match(/^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  return m && Number(m[1]) < 24 && Number(m[2]) < 60
    ? { hour: Number(m[1]), minute: Number(m[2]) }
    : null;
}
const pad = (value: number) => String(value).padStart(2, '0');
export function enhanceTimePicker(input: HTMLInputElement, options: TimePickerOptions = {}) {
  if (input.type !== 'time') throw new TypeError('Time picker requires input[type=time]');
  const scope = mount(input, 'eui-time-input', ['aria-haspopup', 'aria-controls', 'aria-expanded']);
  const dialog = document.createElement('dialog');
  dialog.className = 'eui-time-picker';
  dialog.innerHTML =
    '<h2 data-title></h2><div class="eui-time-fields"><label><span>小时</span><button type="button" class="eui-time-unit" data-hour-display aria-label="选择小时"></button><input data-hour type="number" inputmode="numeric" aria-label="小时" required></label><span aria-hidden="true">:</span><label><span>分钟</span><button type="button" class="eui-time-unit" data-minute-display aria-label="选择分钟"></button><input data-minute type="number" min="0" max="59" inputmode="numeric" aria-label="分钟" required></label><div class="eui-time-period"><button type="button" data-period="am">AM</button><button type="button" data-period="pm">PM</button></div></div><div class="eui-clock-dial" role="group" aria-label="时钟选择"><span class="eui-clock-hand" aria-hidden="true"><span class="eui-clock-selector"></span></span><div data-numbers></div></div><div class="eui-picker-actions"><button type="button" data-mode aria-label="切换时钟或键盘输入"></button><button type="button" data-cancel>取消</button><button type="button" data-confirm>确定</button></div>';
  input.ownerDocument.body.append(dialog);
  scope.add(() => dialog.remove());
  const q = <T extends HTMLElement>(selector: string) => dialog.querySelector<T>(selector)!;
  const title = q('[data-title]');
  title.id = uniqueId('eui-time-title');
  title.textContent = options.label ?? '选择时间';
  dialog.setAttribute('aria-labelledby', title.id);
  const hours = q<HTMLInputElement>('[data-hour]'),
    minutes = q<HTMLInputElement>('[data-minute]'),
    dial = q('.eui-clock-dial'),
    numbers = q('[data-numbers]'),
    hand = q('.eui-clock-hand'),
    confirm = q<HTMLButtonElement>('[data-confirm]');
  const format = options.format ?? 24;
  const hourDisplay = q<HTMLButtonElement>('[data-hour-display]'),
    minuteDisplay = q<HTMLButtonElement>('[data-minute-display]');
  const fieldLabels = [hours, minutes].map((field, index) => {
    const previous = field.parentElement!,
      container = document.createElement('div');
    container.className = 'eui-time-unit-field';
    previous.replaceWith(container);
    container.append(...previous.childNodes);
    const caption = container.querySelector('span')!,
      label = document.createElement('label');
    label.textContent = caption.textContent;
    caption.replaceWith(label);
    field.id = uniqueId('eui-time-field');
    (index === 0 ? hourDisplay : minuteDisplay).id = uniqueId('eui-time-unit');
    return label;
  });
  const effects: ReturnType<typeof interactive>[] = [];
  for (const button of [
    hourDisplay,
    minuteDisplay,
    ...dialog.querySelectorAll<HTMLButtonElement>('[data-period]'),
  ])
    effects.push(interactive(button, scope, options.motionScheme));
  const displayValues = [document.createElement('span'), document.createElement('span')];
  hourDisplay.append(displayValues[0]!);
  minuteDisplay.append(displayValues[1]!);
  // Paint the same upright numerals over the selector, clipped to its actual
  // animated position. Text changes contrast only where the circle covers it.
  const selectedNumbers = document.createElement('div');
  selectedNumbers.className = 'eui-clock-selected-numbers';
  selectedNumbers.setAttribute('aria-hidden', 'true');
  dial.append(selectedNumbers);
  const clockButtons = Array.from({ length: 24 }, () => {
    const button = document.createElement('button');
    button.type = 'button';
    const label = document.createElement('span');
    label.className = 'eui-clock-number-label';
    button.append(label);
    numbers.append(button);
    const effect = interactive(button, scope, options.motionScheme);
    effects.push(effect);
    const selectedLabel = document.createElement('span');
    selectedNumbers.append(selectedLabel);
    return { button, label, selectedLabel, effect, selected: false };
  });
  const clockFocus = rovingFocus(
    numbers,
    scope,
    () => clockButtons.filter((item) => !item.button.hidden).map((item) => item.button),
    { orientation: 'both' },
  );
  hours.min = format === 24 ? '0' : '1';
  hours.max = format === 24 ? '23' : '12';
  q('.eui-time-period').hidden = format === 24;
  let hour = 0,
    minute = 0,
    unit: 'hour' | 'minute' = 'hour',
    mode = options.mode ?? 'dial',
    angle = 0,
    handRadius = 104,
    drag: { id: number; x: number; y: number; moved: boolean; onNumber: boolean } | undefined,
    suppressClick = false;
  function updateSelectedClip() {
    const radians = ((angle - 90) * Math.PI) / 180;
    selectedNumbers.style.clipPath = `circle(24px at ${128 + handRadius * Math.cos(radians)}px ${128 + handRadius * Math.sin(radians)}px)`;
  }
  const rotation = createSpring(
    0,
    (value) => {
      angle = value;
      hand.style.transform = `rotate(${value}deg)`;
      updateSelectedClip();
    },
    motionPreset(options.motionScheme, 'fast.spatial'),
  );
  scope.add(() => rotation.destroy());
  function value() {
    return `${pad(hour)}:${pad(minute)}`;
  }
  function valid() {
    if (mode === 'input' && (!hours.validity.valid || !minutes.validity.valid)) return false;
    const probe = input.cloneNode() as HTMLInputElement;
    probe.value = value();
    return probe.checkValidity();
  }
  function render(animate = true) {
    hours.value = pad(format === 24 ? hour : hour % 12 || 12);
    minutes.value = pad(minute);
    hours.dataset.selected = String(unit === 'hour');
    minutes.dataset.selected = String(unit === 'minute');
    hours.hidden = minutes.hidden = mode === 'dial';
    hourDisplay.hidden = minuteDisplay.hidden = mode === 'input';
    fieldLabels[0]!.htmlFor = mode === 'dial' ? hourDisplay.id : hours.id;
    fieldLabels[1]!.htmlFor = mode === 'dial' ? minuteDisplay.id : minutes.id;
    displayValues[0]!.textContent = hours.value;
    displayValues[1]!.textContent = minutes.value;
    hourDisplay.setAttribute('aria-pressed', String(unit === 'hour'));
    minuteDisplay.setAttribute('aria-pressed', String(unit === 'minute'));
    hourDisplay.setAttribute('aria-label', `小时 ${hours.value}`);
    minuteDisplay.setAttribute('aria-label', `分钟 ${minutes.value}`);
    for (const button of dialog.querySelectorAll<HTMLButtonElement>('[data-period]'))
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.period === (hour >= 12 ? 'pm' : 'am')),
      );
    dial.hidden = mode === 'input';
    modeButton.setAttribute('aria-label', mode === 'dial' ? '切换为键盘输入' : '切换为时钟选择');
    modeButton.removeAttribute('aria-pressed');
    keyboardShape.style.display = mode === 'dial' ? '' : 'none';
    clockShape.style.display = mode === 'input' ? '' : 'none';
    const current = unit === 'hour' ? (hour % 12) * 30 : minute * 6;
    const target = angle + ((((current - angle) % 360) + 540) % 360) - 180;
    handRadius = unit === 'hour' && format === 24 && hour >= 12 ? 64 : 104;
    hand.style.height = `${handRadius}px`;
    updateSelectedClip();
    if (animate) rotation.setTarget(target);
    else rotation.jump(target);
    const count = unit === 'hour' && format === 24 ? 24 : 12;
    for (let i = 0; i < clockButtons.length; i++) {
      const { button, label, selectedLabel, effect } = clockButtons[i]!;
      button.hidden = selectedLabel.hidden = i >= count;
      if (i >= count) continue;
      const inner = i >= 12,
        index = i % 12,
        number =
          unit === 'minute'
            ? index * 5
            : format === 24
              ? i === 0
                ? 12
                : i === 12
                  ? 0
                  : i
              : index === 0
                ? 12
                : index;
      label.textContent = pad(number);
      selectedLabel.textContent = label.textContent;
      button.dataset.clockValue = String(number);
      button.setAttribute('aria-label', `${number}${unit === 'hour' ? '时' : '分'}`);
      const nextSelected =
        unit === 'hour'
          ? format === 24
            ? hour === number
            : (hour % 12 || 12) === number
          : minute === number;
      if (button.getAttribute('aria-pressed') !== String(nextSelected))
        button.setAttribute('aria-pressed', String(nextSelected));
      const radius = inner ? 64 : 104,
        a = ((index * 30 - 90) * Math.PI) / 180;
      button.style.left = `${128 + radius * Math.cos(a)}px`;
      button.style.top = `${128 + radius * Math.sin(a)}px`;
      selectedLabel.style.left = button.style.left;
      selectedLabel.style.top = button.style.top;
      const selected = button.getAttribute('aria-pressed') === 'true';
      if (clockButtons[i]!.selected !== selected || !animate) {
        effect.refresh(animate);
        clockButtons[i]!.selected = selected;
      }
    }
    const selectedClock = clockButtons.find(
      (item) => !item.button.hidden && item.button.getAttribute('aria-pressed') === 'true',
    )?.button;
    clockFocus.refresh(selectedClock);
    confirm.disabled = !valid();
  }
  function choose(number: number, advance = true) {
    if (unit === 'hour') {
      hour = format === 24 ? number : (number % 12) + (hour >= 12 ? 12 : 0);
      if (advance) unit = 'minute';
    } else minute = number;
    render();
    if (numbers.contains(document.activeElement)) clockFocus.focus();
  }
  function point(e: PointerEvent) {
    const rect = dial.getBoundingClientRect(),
      x = ((e.clientX - rect.left) * 256) / (rect.width || 256) - 128,
      y = ((e.clientY - rect.top) * 256) / (rect.height || 256) - 128;
    const a = ((Math.atan2(y, x) * 180) / Math.PI + 450) % 360;
    if (unit === 'hour') {
      let number = Math.round(a / 30) % 12;
      if (format === 24)
        number =
          Math.hypot(x, y) < 80 ? (number === 0 ? 0 : number + 12) : number === 0 ? 12 : number;
      else number = number || 12;
      choose(number, false);
    } else choose(Math.round(a / 6) % 60, false);
  }
  scope.listen(numbers, 'click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-clock-value]');
    if (button && !drag?.moved) choose(Number(button.dataset.clockValue));
  });
  scope.listen(dial, 'pointerdown', (event) => {
    const e = event as PointerEvent;
    if (e.button !== 0 || drag) return;
    e.preventDefault();
    suppressClick = false;
    const onNumber = !!(e.target as Element).closest('[data-clock-value]');
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, onNumber };
    // Number buttons already capture through bindPress. Keep that owner so its
    // ripple and pressed state receive pointerup, which then bubbles to the dial.
    if (!onNumber)
      try {
        dial.setPointerCapture(e.pointerId);
      } catch {}
  });
  scope.listen(dial, 'pointermove', (event) => {
    const e = event as PointerEvent;
    if (!drag || e.pointerId !== drag.id) return;
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 3) drag.moved = true;
    if (drag.moved) {
      e.preventDefault();
      point(e);
    }
  });
  scope.listen(dial, 'pointerup', (event) => {
    const e = event as PointerEvent;
    if (!drag || e.pointerId !== drag.id) return;
    const { moved, onNumber } = drag;
    drag = undefined;
    suppressClick = moved;
    if (moved || !onNumber) {
      point(e);
      if (unit === 'hour') {
        unit = 'minute';
        render();
      }
      e.preventDefault();
    }
  });
  scope.listen(dial, 'pointercancel', () => {
    drag = undefined;
  });
  scope.listen(dial, 'lostpointercapture', () => {
    drag = undefined;
  });
  scope.listen(
    dial,
    'click',
    (event) => {
      if (suppressClick) {
        suppressClick = false;
        event.preventDefault();
        event.stopPropagation();
      }
    },
    { capture: true },
  );
  scope.listen(hourDisplay, 'click', () => {
    unit = 'hour';
    render();
  });
  scope.listen(minuteDisplay, 'click', () => {
    unit = 'minute';
    render();
  });
  for (const [field, key] of [
    [hours, 'hour'],
    [minutes, 'minute'],
  ] as const) {
    scope.listen(field, 'focus', () => {
      unit = key;
      if (mode === 'dial') render();
      else {
        hours.dataset.selected = String(key === 'hour');
        minutes.dataset.selected = String(key === 'minute');
      }
    });
    scope.listen(field, 'input', () => {
      const n = Number(field.value);
      if (!Number.isInteger(n) || field.value === '') {
        field.setAttribute('aria-invalid', 'true');
        confirm.disabled = true;
        return;
      }
      if (key === 'hour' && n >= Number(hours.min) && n <= Number(hours.max))
        hour = format === 24 ? n : (n % 12) + (hour >= 12 ? 12 : 0);
      else if (key === 'minute' && n >= 0 && n < 60) minute = n;
      field.setAttribute('aria-invalid', String(!field.validity.valid));
      confirm.disabled = !valid();
    });
    scope.listen(field, 'change', () => {
      if (field.validity.valid) {
        field.value = pad(Number(field.value));
        field.removeAttribute('aria-invalid');
      }
      confirm.disabled = !valid();
    });
  }
  for (const button of dialog.querySelectorAll<HTMLButtonElement>('[data-period]'))
    scope.listen(button, 'click', () => {
      hour = (hour % 12) + (button.dataset.period === 'pm' ? 12 : 0);
      render();
    });
  scope.listen(q('[data-mode]'), 'click', () => {
    if (mode === 'input' && !valid()) {
      (hours.validity.valid ? minutes : hours).focus({ preventScroll: true });
      return;
    }
    mode = mode === 'dial' ? 'input' : 'dial';
    render();
    if (mode === 'input') (unit === 'hour' ? hours : minutes).focus({ preventScroll: true });
    else (unit === 'hour' ? hourDisplay : minuteDisplay).focus({ preventScroll: true });
  });
  const modeButton = q<HTMLButtonElement>('[data-mode]');
  modeButton.innerHTML =
    '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><g data-keyboard-shape><rect x="2" y="5" width="20" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 9h2m2 0h2m2 0h2m2 0h2M5 12h2m2 0h2m2 0h2m2 0h2M7 15h10" fill="none" stroke="currentColor" stroke-width="1.8"/></g><g data-clock-shape><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l4 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></g></svg>';
  const keyboardShape = modeButton.querySelector<SVGGElement>('[data-keyboard-shape]')!,
    clockShape = modeButton.querySelector<SVGGElement>('[data-clock-shape]')!;
  const modeController = enhanceIconButton(modeButton, {
    motionScheme: options.motionScheme ?? 'expressive',
  });
  scope.add(() => modeController.destroy());
  const controller = enhanceDialog(dialog, {
    motionScheme: options.motionScheme ?? 'expressive',
    initialFocus: () => (mode === 'dial' ? hourDisplay : hours),
  });
  scope.add(() => controller.destroy());
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'eui-picker-trigger';
  const triggerIcon = document.createElement('span');
  triggerIcon.dataset.icon = '';
  triggerIcon.append(controlIcon('clock'));
  trigger.append(triggerIcon);
  trigger.setAttribute('aria-label', options.label ?? '打开时间选择器');
  input.after(trigger);
  scope.add(() => trigger.remove());
  const buttonControllers: ReturnType<typeof enhanceButton>[] = [];
  for (const button of [trigger, q<HTMLButtonElement>('[data-cancel]'), confirm]) {
    const enhanced = enhanceButton(button, {
      variant: 'text',
      motionScheme: options.motionScheme ?? 'expressive',
    });
    buttonControllers.push(enhanced);
    scope.add(() => enhanced.destroy());
  }
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', dialog.id);
  trigger.setAttribute('aria-expanded', 'false');
  function open() {
    if (scope.disposed || input.matches(':disabled') || input.readOnly) return;
    const selected = parseTime(input.value) ?? { hour: 0, minute: 0 };
    hour = selected.hour;
    minute = selected.minute;
    unit = 'hour';
    render(false);
    controller.open();
    trigger.setAttribute('aria-expanded', String(controller.isOpen));
  }
  scope.listen(trigger, 'click', open);
  scope.listen(input, 'keydown', (event) => {
    const e = event as KeyboardEvent;
    if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      open();
    }
  });
  scope.listen(dialog, 'eui-close', () => trigger.setAttribute('aria-expanded', 'false'));
  scope.listen(dialog, 'eui-closing', () => trigger.setAttribute('aria-expanded', 'false'));
  scope.listen(q('[data-cancel]'), 'click', () => controller.close('cancel'));
  scope.listen(confirm, 'click', () => {
    if (!valid()) return;
    input.value = value();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    controller.close('confirm');
  });
  return {
    element: input,
    dialog,
    open,
    close: controller.close,
    get isOpen() {
      return controller.isOpen;
    },
    update(next: Partial<Pick<TimePickerOptions, 'motionScheme' | 'label'>>) {
      Object.assign(options, next);
      rotation.configure(motionPreset(options.motionScheme, 'fast.spatial'));
      modeController.update({ motionScheme: options.motionScheme ?? 'expressive' });
      for (const effect of effects) effect.configure(options.motionScheme ?? 'expressive');
      controller.update({ motionScheme: options.motionScheme ?? 'expressive' });
      for (const button of buttonControllers)
        button.update({ motionScheme: options.motionScheme ?? 'expressive' });
      if (next.label) title.textContent = next.label;
    },
    destroy() {
      scope.dispose();
    },
  };
}
