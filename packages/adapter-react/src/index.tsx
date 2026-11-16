import { createElement, forwardRef, useEffect, useRef, useImperativeHandle } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, HTMLAttributes } from 'react';
import {
  enhanceButton,
  enhanceFab,
  enhanceSwitch,
  enhanceLoadingIndicator,
  enhanceIconButton,
  enhanceCheckbox,
  enhanceRadio,
  enhanceSlider,
} from '@amiracle1024/components';
import type {
  ButtonOptions,
  FabOptions,
  SwitchOptions,
  LoadingIndicatorOptions,
  IconButtonOptions,
  CheckboxOptions,
  RadioOptions,
  SliderOptions,
} from '@amiracle1024/components';
type ButtonController = ReturnType<typeof enhanceButton>;
type FabController = ReturnType<typeof enhanceFab>;
type SwitchController = ReturnType<typeof enhanceSwitch>;
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { options?: IconButtonOptions }
>(function IconButton({ options, children, ...props }, ref) {
  const element = useRef<HTMLButtonElement>(null),
    controller = useRef<ReturnType<typeof enhanceIconButton> | null>(null);
  useImperativeHandle(ref, () => element.current!, []);
  useEffect(() => {
    controller.current = enhanceIconButton(element.current!, options);
    return () => {
      controller.current?.destroy();
      controller.current = null;
    };
  }, []);
  useEffect(() => controller.current?.update(options ?? {}), [options]);
  return createElement(
    'button',
    { ...props, ref: element },
    createElement('span', { 'data-eui-react-slot': '' }, children),
  );
});
export const Checkbox = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> & {
    options?: CheckboxOptions;
    indeterminate?: boolean;
  }
>(function Checkbox({ options, indeterminate = false, ...props }, ref) {
  const element = useRef<HTMLInputElement>(null),
    controller = useRef<ReturnType<typeof enhanceCheckbox> | null>(null);
  useImperativeHandle(ref, () => element.current!, []);
  useEffect(() => {
    element.current!.indeterminate = indeterminate;
    controller.current = enhanceCheckbox(element.current!, options);
    return () => {
      controller.current?.destroy();
      controller.current = null;
    };
  }, []);
  useEffect(() => {
    element.current!.indeterminate = indeterminate;
    controller.current?.update(options ?? {});
    controller.current?.refresh();
  }, [options, props.checked, indeterminate]);
  return createElement(
    'span',
    null,
    createElement('input', { ...props, type: 'checkbox', ref: element }),
  );
});
export const Radio = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> & { options?: RadioOptions }
>(function Radio({ options, ...props }, ref) {
  const element = useRef<HTMLInputElement>(null),
    controller = useRef<ReturnType<typeof enhanceRadio> | null>(null);
  useImperativeHandle(ref, () => element.current!, []);
  useEffect(() => {
    controller.current = enhanceRadio(element.current!, options);
    return () => {
      controller.current?.destroy();
      controller.current = null;
    };
  }, []);
  useEffect(() => {
    controller.current?.update(options ?? {});
    controller.current?.refresh();
  }, [options, props.checked, props.name]);
  return createElement(
    'span',
    null,
    createElement('input', { ...props, type: 'radio', ref: element }),
  );
});
export const Slider = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> & { options?: SliderOptions }
>(function Slider({ options, ...props }, ref) {
  const element = useRef<HTMLInputElement>(null),
    controller = useRef<ReturnType<typeof enhanceSlider> | null>(null);
  useImperativeHandle(ref, () => element.current!, []);
  useEffect(() => {
    controller.current = enhanceSlider(element.current!, options);
    return () => {
      controller.current?.destroy();
      controller.current = null;
    };
  }, []);
  useEffect(() => {
    controller.current?.update(options ?? {});
    controller.current?.refresh();
  }, [options, props.value, props.min, props.max, props.step]);
  return createElement(
    'span',
    null,
    createElement('input', { ...props, type: 'range', ref: element }),
  );
});
export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { options?: ButtonOptions }
>(function Button({ options, children, ...props }, ref) {
  const element = useRef<HTMLButtonElement>(null),
    controller = useRef<ButtonController | null>(null);
  useImperativeHandle(ref, () => element.current!, []);
  useEffect(() => {
    const node = element.current!;
    controller.current = enhanceButton(node, options);
    return () => {
      controller.current?.destroy();
      controller.current = null;
    };
  }, []);
  useEffect(() => controller.current?.update(options ?? {}), [options]);
  // A dedicated slot keeps React's child reconciliation separate from decorative SVG nodes.
  return createElement(
    'button',
    { ...props, ref: element },
    createElement('span', { 'data-eui-react-slot': '' }, children),
  );
});
export const Fab = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { options?: FabOptions }
>(function Fab({ options, children, ...props }, ref) {
  const element = useRef<HTMLButtonElement>(null),
    controller = useRef<FabController | null>(null);
  useImperativeHandle(ref, () => element.current!, []);
  useEffect(() => {
    controller.current = enhanceFab(element.current!, options);
    return () => {
      controller.current?.destroy();
      controller.current = null;
    };
  }, []);
  useEffect(() => controller.current?.update(options ?? {}), [options]);
  return createElement(
    'button',
    { ...props, ref: element },
    createElement('span', { 'data-eui-react-slot': '' }, children),
  );
});
export const Switch = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> & { options?: SwitchOptions }
>(function Switch({ options, ...props }, ref) {
  const element = useRef<HTMLInputElement>(null),
    controller = useRef<SwitchController | null>(null);
  useImperativeHandle(ref, () => element.current!, []);
  useEffect(() => {
    controller.current = enhanceSwitch(element.current!, options);
    return () => {
      controller.current?.destroy();
      controller.current = null;
    };
  }, []);
  useEffect(() => {
    controller.current?.update(options ?? {});
    controller.current?.refresh();
  }, [options, props.checked]);
  return createElement(
    'span',
    { className: 'eui-switch' },
    createElement('input', { ...props, type: 'checkbox', ref: element }),
  );
});
export const LoadingIndicator = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & { options?: LoadingIndicatorOptions }
>(function LoadingIndicator({ options, ...props }, ref) {
  const element = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => element.current!, []);
  const { label, contained, backend, autoplay, onGeometryMeasure } = options ?? {};
  useEffect(() => {
    const controller = enhanceLoadingIndicator(element.current!, options);
    return () => controller.destroy();
  }, [label, contained, backend, autoplay, onGeometryMeasure]);
  return createElement('div', { ...props, ref: element });
});
