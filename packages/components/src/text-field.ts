import { createSpring, motionPreset } from '@epui/motion';
import type { MotionScheme } from '@epui/motion';
import { mount } from './shared.js';
import { uniqueId, preserveAttributes } from './collection.js';
import { animateColors } from './animated-styles.js';
export interface TextFieldOptions {
  variant?: 'filled' | 'outlined';
  label?: string;
  supportingText?: string;
  error?: boolean;
  errorText?: string;
  counter?: boolean;
  motionScheme?: MotionScheme;
}
/** Enhance a native input/textarea; labels and supporting text are real DOM. */
export function enhanceTextField(
  input: HTMLInputElement | HTMLTextAreaElement,
  initial: TextFieldOptions = {},
) {
  if (!input.parentElement) throw new TypeError('Text field requires a dedicated wrapper');
  const host = input.parentElement,
    scope = mount(input, 'eui-text-field-input', [
      'id',
      'aria-describedby',
      'aria-invalid',
      'style',
    ]);
  preserveAttributes(scope, host, [
    'class',
    'data-variant',
    'data-error',
    'data-disabled',
    'data-focused',
    'data-populated',
    'data-has-label',
    'style',
  ]);
  host.classList.add('eui-text-field');
  if (!input.id) input.id = uniqueId('eui-field');
  const label = document.createElement('label');
  label.className = 'eui-text-field-label';
  label.htmlFor = input.id;
  const supporting = document.createElement('span');
  supporting.className = 'eui-text-field-supporting';
  supporting.id = uniqueId('eui-support');
  const counter = document.createElement('span');
  counter.className = 'eui-text-field-counter';
  counter.setAttribute('aria-hidden', 'true');
  host.append(label, supporting, counter);
  scope.add(() => {
    label.remove();
    supporting.remove();
    counter.remove();
  });
  const originalDescription = input.getAttribute('aria-describedby') ?? '';
  let options = { ...initial },
    focused = false;
  const colors = animateColors(
    input,
    [
      { element: input, property: 'color' },
      { element: input, property: 'border-color' },
      { element: label, property: 'color' },
      { element: supporting, property: 'color' },
    ],
    options.motionScheme,
  );
  scope.add(() => colors.destroy());
  const spring = createSpring(
    input.value ? 1 : 0,
    (value) => host.style.setProperty('--_eui-label-progress', String(value)),
    motionPreset(options.motionScheme, 'fast.spatial'),
  );
  scope.add(() => spring.destroy());
  function refresh(animate = true) {
    if (scope.disposed) return;
    const invalid = options.error ?? false,
      disabled = input.matches(':disabled'),
      populated = input.value.length > 0;
    host.dataset.variant = options.variant ?? 'filled';
    host.dataset.error = String(invalid);
    host.dataset.disabled = String(disabled);
    host.dataset.focused = String(focused);
    host.dataset.populated = String(populated);
    host.dataset.hasLabel = String(!!options.label);
    label.textContent = options.label ?? '';
    label.hidden = !options.label;
    const support = invalid
      ? (options.errorText ?? options.supportingText ?? '')
      : (options.supportingText ?? '');
    supporting.textContent = support;
    supporting.hidden = !support;
    supporting.setAttribute('aria-live', invalid ? 'polite' : 'off');
    input.setAttribute(
      'aria-describedby',
      [originalDescription, support ? supporting.id : ''].filter(Boolean).join(' '),
    );
    if (invalid) input.setAttribute('aria-invalid', 'true');
    else if (options.error !== undefined) input.removeAttribute('aria-invalid');
    const max = input.maxLength;
    counter.hidden = !options.counter;
    counter.textContent =
      max >= 0 ? `${[...input.value].length} / ${max}` : String([...input.value].length);
    const target = focused || populated ? 1 : 0;
    spring.configure(motionPreset(options.motionScheme, 'fast.spatial'));
    if (animate && !disabled) spring.setTarget(target);
    else spring.jump(target);
    colors.configure(options.motionScheme ?? 'expressive');
    colors.refresh(animate);
  }
  scope.listen(input, 'input', () => refresh());
  scope.listen(input, 'change', () => refresh());
  scope.listen(input, 'focus', () => {
    focused = true;
    refresh();
  });
  scope.listen(input, 'blur', () => {
    focused = false;
    refresh();
  });
  const observer = new MutationObserver(() => refresh());
  observer.observe(input, {
    attributes: true,
    attributeFilter: ['disabled', 'value', 'required', 'maxlength', 'placeholder', 'readonly'],
  });
  for (let node: HTMLElement | null = input.parentElement; node; node = node.parentElement)
    if (node.tagName === 'FIELDSET')
      observer.observe(node, { attributes: true, attributeFilter: ['disabled'] });
  scope.add(() => observer.disconnect());
  if (input.form)
    scope.listen(input.form, 'reset', (event) =>
      queueMicrotask(() => {
        if (!event.defaultPrevented) refresh(false);
      }),
    );
  refresh(false);
  return {
    element: input,
    refresh,
    update(next: Partial<TextFieldOptions>) {
      options = { ...options, ...next };
      refresh();
    },
    setValue(value: string, { notify = false } = {}) {
      if (scope.disposed) return;
      input.value = value;
      refresh();
      if (notify) {
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    },
    destroy() {
      scope.dispose();
    },
  };
}
