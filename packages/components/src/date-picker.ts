import { mount } from './shared.js';
import { preserveAttributes, uniqueId } from './collection.js';
import { enhanceDialog } from './dialog.js';
import { enhanceButton } from './button.js';
import type { MotionScheme } from '@amiracle1024/motion';
import { createSpring, motionPreset } from '@amiracle1024/motion';
import { interactive } from './interactive.js';
import { enhanceSelect } from './select.js';
import { enhanceIconButton } from './icon-button.js';
import { controlIcon } from './svg.js';
const DAY = 86400000;
export function parseISODate(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
}
export function formatISODate(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}
export interface DatePickerOptions {
  mode?: 'single' | 'range';
  endInput?: HTMLInputElement;
  locale?: string;
  firstDayOfWeek?: number;
  label?: string;
  isDateDisabled?: (iso: string) => boolean;
  motionScheme?: MotionScheme;
}
export function enhanceDatePicker(input: HTMLInputElement, options: DatePickerOptions = {}) {
  if (input.type !== 'date') throw new TypeError('Date picker requires input[type=date]');
  if (options.mode === 'range' && options.endInput?.type !== 'date')
    throw new TypeError('Date range requires a second input[type=date]');
  const scope = mount(input, 'eui-date-input', ['aria-haspopup', 'aria-controls', 'aria-expanded']);
  const dialog = document.createElement('dialog');
  dialog.className = 'eui-date-picker';
  dialog.dataset.mode = options.mode ?? 'single';
  dialog.id = uniqueId('eui-calendar');
  dialog.innerHTML =
    '<div class="eui-picker-header"><span data-caption></span><h2 data-title></h2></div><div class="eui-calendar-navigation"><button type="button" data-prev aria-label="上个月">‹</button><select data-month aria-label="月份"></select><input data-year type="number" min="1" max="9999" aria-label="年份"><button type="button" data-next aria-label="下个月">›</button></div><div class="eui-calendar-weekdays" aria-hidden="true"></div><div class="eui-calendar-grid" role="grid"></div><div class="eui-picker-actions"><button type="button" data-cancel>取消</button><button type="button" data-confirm>确定</button></div>';
  input.ownerDocument.body.append(dialog);
  scope.add(() => dialog.remove());
  const q = <T extends HTMLElement>(selector: string) => dialog.querySelector<T>(selector)!;
  const title = q('[data-title]');
  title.id = uniqueId('eui-calendar-title');
  dialog.setAttribute('aria-labelledby', title.id);
  const caption = q('[data-caption]');
  caption.textContent = options.label ?? (options.mode === 'range' ? '选择日期范围' : '选择日期');
  const grid = q('.eui-calendar-grid');
  grid.setAttribute('aria-label', '日期');
  const monthSelect = q<HTMLSelectElement>('[data-month]'),
    yearInput = q<HTMLInputElement>('[data-year]');
  const locale = options.locale ?? 'zh-CN',
    today =
      parseISODate(new Date().toLocaleDateString('en-CA')) ?? Math.floor(Date.now() / DAY) * DAY;
  const fullDate = new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' }),
    shortDate = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  const firstDay = options.firstDayOfWeek ?? 0;
  if (!Number.isInteger(firstDay) || firstDay < 0 || firstDay > 6)
    throw new RangeError('firstDayOfWeek must be 0–6');
  for (let month = 0; month < 12; month++) {
    const option = document.createElement('option');
    option.value = String(month);
    option.textContent = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2024, month, 1)),
    );
    monthSelect.append(option);
  }
  for (let weekday = 0; weekday < 7; weekday++) {
    const label = document.createElement('span');
    label.textContent = new Intl.DateTimeFormat(locale, {
      weekday: 'narrow',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(2024, 0, 7 + ((weekday + firstDay) % 7))));
    q('.eui-calendar-weekdays').append(label);
  }
  const monthController = enhanceSelect(monthSelect, {
    label: '月份',
    variant: 'text',
    motionScheme: options.motionScheme ?? 'expressive',
  });
  scope.add(() => monthController.destroy());
  const navigationControllers = [
    q<HTMLButtonElement>('[data-prev]'),
    q<HTMLButtonElement>('[data-next]'),
  ].map((button, index) => {
    button.replaceChildren(controlIcon(index ? 'next' : 'previous'));
    return enhanceIconButton(button, { motionScheme: options.motionScheme ?? 'expressive' });
  });
  for (const button of navigationControllers) scope.add(() => button.destroy());
  let start: number | null = null,
    end: number | null = null,
    focused = today,
    month = new Date(today).getUTCMonth(),
    year = new Date(today).getUTCFullYear(),
    selectingEnd = false;
  const controller = enhanceDialog(dialog, {
    motionScheme: options.motionScheme ?? 'expressive',
    initialFocus: () => grid.querySelector<HTMLElement>('[tabindex="0"]'),
  });
  scope.add(() => controller.destroy());
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'eui-picker-trigger';
  const triggerIcon = document.createElement('span');
  triggerIcon.dataset.icon = '';
  triggerIcon.append(controlIcon('calendar'));
  trigger.append(triggerIcon);
  trigger.setAttribute('aria-label', options.label ?? '打开日期选择器');
  input.after(trigger);
  scope.add(() => trigger.remove());
  const triggerButton = enhanceButton(trigger, {
    variant: 'text',
    motionScheme: options.motionScheme ?? 'expressive',
  });
  const buttonControllers = [triggerButton];
  scope.add(() => triggerButton.destroy());
  for (const button of [
    q<HTMLButtonElement>('[data-confirm]'),
    q<HTMLButtonElement>('[data-cancel]'),
  ]) {
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
  const pickerTriggers = [trigger];
  if (options.endInput) {
    preserveAttributes(scope, options.endInput, [
      'aria-haspopup',
      'aria-controls',
      'aria-expanded',
      'class',
    ]);
    options.endInput.classList.add('eui-date-range-end');
    options.endInput.setAttribute('aria-haspopup', 'dialog');
    options.endInput.setAttribute('aria-controls', dialog.id);

    const endTrigger = document.createElement('button');
    endTrigger.type = 'button';
    endTrigger.className = 'eui-picker-trigger';
    const endIcon = document.createElement('span');
    endIcon.dataset.icon = '';
    endIcon.append(controlIcon('calendar'));
    endTrigger.append(endIcon);
    endTrigger.setAttribute('aria-label', '选择结束日期');
    endTrigger.setAttribute('aria-haspopup', 'dialog');
    endTrigger.setAttribute('aria-controls', dialog.id);
    endTrigger.setAttribute('aria-expanded', 'false');
    pickerTriggers.push(endTrigger);
    options.endInput.after(endTrigger);
    scope.add(() => endTrigger.remove());
    const endButton = enhanceButton(endTrigger, {
      variant: 'text',
      motionScheme: options.motionScheme ?? 'expressive',
    });
    buttonControllers.push(endButton);
    scope.add(() => endButton.destroy());
    scope.listen(endTrigger, 'click', () => open());
    scope.listen(options.endInput, 'keydown', (event) => {
      const e = event as KeyboardEvent;
      if (e.altKey && e.key === 'ArrowDown') {
        e.preventDefault();
        open();
      }
    });
  }
  let displayedMonth = year * 12 + month,
    monthDirection = 1;
  const monthMotion = createSpring(
    1,
    (value) => {
      grid.style.opacity = String(Math.max(0, Math.min(1, value)));
      grid.style.transform = `translateX(${(1 - value) * monthDirection * 12}px)`;
    },
    motionPreset(options.motionScheme, 'fast.effects'),
  );
  scope.add(() => monthMotion.destroy());
  // Reuse the calendar's DOM through selection changes. Replacing all cells here
  // previously discarded press/focus feedback and restarted every visual state.
  const weeks = Array.from({ length: 6 }, () => {
    const row = document.createElement('div');
    row.setAttribute('role', 'row');
    grid.append(row);
    return row;
  });
  const days = Array.from({ length: 42 }, (_, index) => {
    const cell = document.createElement('span');
    cell.setAttribute('role', 'gridcell');
    const button = document.createElement('button');
    button.type = 'button';
    const fill = document.createElement('span');
    fill.className = 'eui-calendar-range';
    fill.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'eui-calendar-day-label';
    button.append(label);
    cell.append(fill, button);
    weeks[Math.floor(index / 7)]!.append(cell);
    const effects = interactive(button, scope, options.motionScheme);
    const range = createSpring(
      0,
      (value) => (fill.style.opacity = String(Math.max(0, Math.min(1, value)))),
      motionPreset(options.motionScheme, 'fast.effects'),
    );
    scope.add(() => range.destroy());
    return { cell, button, label, effects, range };
  });
  function allowed(value: number) {
    const target = selectingEnd && options.endInput ? options.endInput : input,
      min = parseISODate(target.min),
      max = parseISODate(target.max);
    return (
      new Date(value).getUTCFullYear() >= 1 &&
      new Date(value).getUTCFullYear() <= 9999 &&
      (min === null || value >= min) &&
      (max === null || value <= max) &&
      !options.isDateDisabled?.(formatISODate(value))
    );
  }
  function showMonth(value: number) {
    focused = value;
    const date = new Date(value);
    year = date.getUTCFullYear();
    month = date.getUTCMonth();
    render();
  }
  function render() {
    monthSelect.value = String(month);
    monthController.refresh();
    yearInput.value = String(year);
    title.textContent =
      start === null
        ? '选择日期'
        : options.mode === 'range'
          ? `${shortDate.format(start)} – ${end === null ? '…' : shortDate.format(end)}`
          : fullDate.format(start);
    const first = new Date(0);
    first.setUTCFullYear(year, month, 1);
    first.setUTCHours(0, 0, 0, 0);
    const offset = (first.getUTCDay() - firstDay + 7) % 7;
    const last = new Date(first);
    last.setUTCMonth(month + 1, 0);
    const count = last.getUTCDate();
    const monthKey = year * 12 + month,
      changedMonth = monthKey !== displayedMonth,
      animate = controller.isOpen && !changedMonth;
    if (changedMonth && controller.isOpen) {
      monthDirection = monthKey > displayedMonth ? 1 : -1;
      monthMotion.jump(0);
      monthMotion.setTarget(1);
    } else if (!controller.isOpen) monthMotion.jump(1);
    displayedMonth = monthKey;
    for (const [index, { cell, button, label, effects, range }] of days.entries()) {
      const number = index - offset + 1;
      if (number < 1 || number > count) {
        cell.setAttribute('aria-hidden', 'true');
        cell.removeAttribute('aria-selected');
        cell.dataset.rangeState = 'none';
        button.hidden = true;
        button.disabled = true;
        button.tabIndex = -1;
        button.removeAttribute('data-date');
        range.jump(0);
        continue;
      }
      cell.removeAttribute('aria-hidden');
      button.hidden = false;
      const value = first.getTime() + (number - 1) * DAY;
      label.textContent = String(number);
      button.dataset.date = formatISODate(value);
      button.disabled = !allowed(value);
      button.setAttribute('aria-label', fullDate.format(value));
      button.tabIndex = value === focused ? 0 : -1;
      const selected = value === start || value === end,
        inRange = start !== null && end !== null && value > start && value < end;
      cell.setAttribute('aria-selected', String(selected || inRange));
      cell.dataset.range = String(inRange);
      cell.dataset.rangeState =
        start !== null && end !== null && start !== end
          ? value === start
            ? 'start'
            : value === end
              ? 'end'
              : inRange
                ? 'middle'
                : 'none'
          : 'none';
      const rangeTarget = cell.dataset.rangeState === 'none' ? 0 : 1;
      if (animate) range.setTarget(rangeTarget);
      else range.jump(rangeTarget);
      button.dataset.selected = String(selected);
      if (value === today) button.setAttribute('aria-current', 'date');
      else button.removeAttribute('aria-current');
      effects.refresh(animate);
    }
    for (const [index, row] of weeks.entries())
      row.hidden = index >= Math.ceil((offset + count) / 7);
    if (!grid.querySelector('[tabindex="0"]')) {
      const firstEnabled = grid.querySelector<HTMLButtonElement>('button:not(:disabled)');
      if (firstEnabled) {
        firstEnabled.tabIndex = 0;
        focused = parseISODate(firstEnabled.dataset.date!)!;
      }
    }
    q<HTMLButtonElement>('[data-confirm]').disabled =
      start === null || (options.mode === 'range' && end === null);
  }
  function choose(value: number) {
    if (!allowed(value)) return;
    focused = value;
    if (options.mode === 'range') {
      if (!selectingEnd) {
        start = value;
        end = null;
        selectingEnd = true;
      } else {
        if (start !== null && value < start) {
          end = start;
          start = value;
        } else end = value;
        selectingEnd = false;
      }
    } else start = value;
    render();
    grid.querySelector<HTMLButtonElement>(`[data-date="${formatISODate(value)}"]`)?.focus();
  }
  function open() {
    if (scope.disposed || input.matches(':disabled') || input.readOnly) return;
    start = parseISODate(input.value);
    end = options.endInput ? parseISODate(options.endInput.value) : null;
    selectingEnd = false;
    showMonth(start ?? today);
    controller.open();
    for (const button of pickerTriggers)
      button.setAttribute('aria-expanded', String(controller.isOpen));
  }
  scope.listen(trigger, 'click', open);
  scope.listen(input, 'keydown', (event) => {
    const e = event as KeyboardEvent;
    if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      open();
    }
  });
  scope.listen(dialog, 'eui-close', () => {
    for (const button of pickerTriggers) button.setAttribute('aria-expanded', 'false');
  });
  scope.listen(dialog, 'eui-closing', () => {
    for (const button of pickerTriggers) button.setAttribute('aria-expanded', 'false');
  });
  scope.listen(grid, 'click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-date]');
    if (button) choose(parseISODate(button.dataset.date!)!);
  });
  scope.listen(grid, 'keydown', (event) => {
    const e = event as KeyboardEvent,
      button = (e.target as Element).closest<HTMLButtonElement>('button[data-date]');
    if (!button || e.altKey || e.ctrlKey || e.metaKey) return;
    let value = parseISODate(button.dataset.date!)!,
      delta = 0;
    const rtl = getComputedStyle(grid).direction === 'rtl';
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft')
      delta = (e.key === 'ArrowRight' ? 1 : -1) * (rtl ? -1 : 1);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') delta = e.key === 'ArrowDown' ? 7 : -7;
    else if (e.key === 'Home') delta = -((new Date(value).getUTCDay() - firstDay + 7) % 7);
    else if (e.key === 'End') delta = 6 - ((new Date(value).getUTCDay() - firstDay + 7) % 7);
    else if (e.key === 'PageUp' || e.key === 'PageDown') {
      const date = new Date(value),
        originalDay = date.getUTCDate();
      date.setUTCDate(1);
      date.setUTCMonth(
        date.getUTCMonth() + (e.key === 'PageDown' ? 1 : -1) * (e.shiftKey ? 12 : 1),
      );
      const last = new Date(date);
      last.setUTCMonth(last.getUTCMonth() + 1, 0);
      date.setUTCDate(Math.min(originalDay, last.getUTCDate()));
      value = date.getTime();
    } else return;
    e.preventDefault();
    value += delta * DAY;
    const direction = delta < 0 || e.key === 'PageUp' ? -1 : 1;
    for (let attempt = 0; attempt < 3660 && !allowed(value); attempt++) value += direction * DAY;
    if (allowed(value)) {
      showMonth(value);
      grid.querySelector<HTMLButtonElement>(`[data-date="${formatISODate(value)}"]`)?.focus();
    }
  });
  function changeMonth(delta: number) {
    const date = new Date(0);
    date.setUTCFullYear(year, month + delta, 1);
    showMonth(date.getTime());
  }
  scope.listen(q('[data-prev]'), 'click', () => changeMonth(-1));
  scope.listen(q('[data-next]'), 'click', () => changeMonth(1));
  scope.listen(monthSelect, 'change', () => {
    month = Number(monthSelect.value);
    render();
  });
  scope.listen(yearInput, 'change', () => {
    year = Math.max(1, Math.min(9999, Number(yearInput.value) || year));
    render();
  });
  scope.listen(q('[data-cancel]'), 'click', () => controller.close('cancel'));
  scope.listen(q('[data-confirm]'), 'click', () => {
    if (start === null || (options.mode === 'range' && end === null)) return;
    const values:
      [[HTMLInputElement, number]] | [[HTMLInputElement, number], [HTMLInputElement, number]] =
      options.endInput && end !== null
        ? [
            [input, start],
            [options.endInput, end],
          ]
        : [[input, start]];
    for (const [node, time] of values) {
      node.value = formatISODate(time);
      node.dispatchEvent(new Event('input', { bubbles: true }));
      node.dispatchEvent(new Event('change', { bubbles: true }));
    }
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
    update(next: Partial<Pick<DatePickerOptions, 'motionScheme' | 'label'>>) {
      Object.assign(options, next);
      monthController.update({ motionScheme: options.motionScheme ?? 'expressive' });
      for (const button of navigationControllers)
        button.update({ motionScheme: options.motionScheme ?? 'expressive' });
      controller.update({ motionScheme: options.motionScheme ?? 'expressive' });
      for (const button of buttonControllers)
        button.update({ motionScheme: options.motionScheme ?? 'expressive' });
      for (const day of days) {
        day.effects.configure(options.motionScheme ?? 'expressive');
        day.range.configure(motionPreset(options.motionScheme, 'fast.effects'));
      }
      monthMotion.configure(motionPreset(options.motionScheme, 'fast.effects'));
      if (next.label) caption.textContent = next.label;
    },
    destroy() {
      scope.dispose();
    },
  };
}
