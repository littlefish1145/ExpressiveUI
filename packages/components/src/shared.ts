import { Scope } from '@expressive-ui/core';
const mounted = new WeakSet<Element>();
export function mount(element: HTMLElement, className: string, attributes: string[]) {
  if (mounted.has(element))
    throw new Error('Element is already enhanced; destroy its controller first');
  mounted.add(element);
  const scope = new Scope();
  const hadClass = element.classList.contains(className);
  const before = new Map(attributes.map((key) => [key, element.getAttribute(key)]));
  element.classList.add(className);
  scope.add(() => {
    mounted.delete(element);
    if (!hadClass) element.classList.remove(className);
    for (const [key, value] of before)
      if (value === null) element.removeAttribute(key);
      else element.setAttribute(key, value);
  });
  return scope;
}
export function decoration(className: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = className;
  span.setAttribute('aria-hidden', 'true');
  return span;
}
