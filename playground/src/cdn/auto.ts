import * as components from '@amiracle1024/components';

export interface CdnController {
  destroy(): void;
  [key: string]: unknown;
}
type Factory = (element: never, options: never) => CdnController;
const factories = new Map<string, Factory>();
for (const [name, factory] of Object.entries(components)) {
  if (!name.startsWith('enhance') || typeof factory !== 'function') continue;
  const key = name
    .slice(7)
    .replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase())
    .slice(1);
  factories.set(key, factory as Factory);
}
const controllers = new Map<HTMLElement, CdnController>();
const selector = '[data-eui]';
let observer: MutationObserver | undefined;

/** Read the existing controller to open a dialog, show a snackbar, or update options. */
export function getController(element: HTMLElement) {
  return controllers.get(element);
}

/** Enhance declarative markup. Safe to call repeatedly, including on a single element. */
export function init(root: ParentNode = document) {
  const elements = [...root.querySelectorAll<HTMLElement>(selector)];
  if (root instanceof HTMLElement && root.matches(selector)) elements.unshift(root);
  for (const element of elements) {
    if (controllers.has(element)) continue;
    const name = element.dataset.eui!;
    try {
      const factory = factories.get(name);
      if (!factory) throw Error('Unknown data-eui component: ' + name);
      const options = JSON.parse(element.dataset.euiOptions || '{}');
      if (!options || Array.isArray(options) || typeof options !== 'object')
        throw Error('data-eui-options must be a JSON object');
      // Simple options stay readable without JSON. Complex values use the npm option names.
      for (const key of ['variant', 'size', 'label', 'supportingText', 'orientation', 'edge']) {
        const attribute = 'data-' + key.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
        if (element.hasAttribute(attribute)) options[key] = element.getAttribute(attribute);
      }
      if (element.hasAttribute('data-anchor')) {
        const anchor = element.ownerDocument.querySelector(element.getAttribute('data-anchor')!);
        if (!(anchor instanceof HTMLElement)) throw Error('data-anchor target not found');
        options.anchor = anchor;
      }
      let controller: CdnController;
      if (name === 'range-slider') {
        const inputs = element.querySelectorAll<HTMLInputElement>('input[type=range]');
        if (inputs.length !== 2) throw Error('range-slider needs two range inputs');
        controller = components.enhanceRangeSlider(inputs[0]!, inputs[1]!, options);
      } else {
        controller = factory(element as never, options as never);
      }
      controllers.set(element, controller);
      element.dispatchEvent(
        new CustomEvent('eui-ready', { bubbles: true, detail: { controller } }),
      );
    } catch (error) {
      element.dispatchEvent(new CustomEvent('eui-error', { bubbles: true, detail: { error } }));
      console.error('[ExpressiveUI]', element, error);
    }
  }
}

/** Release observers, animations and event listeners for a subtree. */
export function destroy(root: ParentNode = document) {
  for (const [element, controller] of controllers) {
    if (root === element || root.contains(element)) {
      controller.destroy();
      controllers.delete(element);
    }
  }
}

export function startAutoInit() {
  if (observer) return;
  init();
  observer = new MutationObserver((records) => {
    // A moved element stays mounted. A genuinely removed subtree is disposed.
    for (const [element, controller] of controllers) {
      if (!element.isConnected) {
        controller.destroy();
        controllers.delete(element);
      }
    }
    for (const record of records) {
      for (const node of record.addedNodes)
        if (node instanceof HTMLElement && node.isConnected) init(node);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('click', onAction);
}
function onAction(event: MouseEvent) {
  const trigger =
    event.target instanceof Element ? event.target.closest<HTMLElement>('[data-eui-open]') : null;
  if (!trigger || trigger.matches(':disabled,[aria-disabled=true]')) return;
  const target = document.getElementById(trigger.dataset.euiOpen!);
  const controller = target && controllers.get(target);
  if (typeof controller?.open === 'function') controller.open();
}
export function stopAutoInit() {
  observer?.disconnect();
  observer = undefined;
  document.removeEventListener('click', onAction);
  destroy();
}
