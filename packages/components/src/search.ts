import { mount } from './shared.js';
import { preserveAttributes, uniqueId, emit } from './collection.js';
import { overlay } from './overlay.js';
import type { MotionScheme } from '@amiracle1024/motion';
import { controlIcon } from './svg.js';
import { enhanceIconButton } from './icon-button.js';
export interface SearchResult {
  id: string;
  label: string;
  value?: string;
  disabled?: boolean;
}
export interface SearchOptions {
  label: string;
  variant?: 'bar' | 'view';
  suggestions?:
    | readonly SearchResult[]
    | ((
        query: string,
        context: { signal: AbortSignal },
      ) => readonly SearchResult[] | Promise<readonly SearchResult[]>);
  debounce?: number;
  motionScheme?: MotionScheme;
}
export function enhanceSearch(host: HTMLElement, initial: SearchOptions) {
  const candidate = host.querySelector<HTMLInputElement>('input[type=search]');
  if (!candidate) throw new TypeError('Search requires input[type=search]');
  const input = candidate;
  const scope = mount(host, 'eui-search', ['data-variant', 'data-focus-visible']);
  preserveAttributes(scope, input, [
    'role',
    'aria-label',
    'aria-autocomplete',
    'aria-controls',
    'aria-expanded',
    'aria-activedescendant',
  ]);
  let options = { ...initial };
  const existingIcon = host.querySelector<HTMLElement>(
    ':scope > [data-search-icon], :scope > [aria-hidden="true"]',
  );
  if (!existingIcon || /^[⌕🔍🔎]$/u.test(existingIcon.textContent?.trim() ?? '')) {
    const icon = document.createElement('span');
    icon.className = 'eui-search-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.append(controlIcon('search'));
    if (existingIcon) existingIcon.replaceWith(icon);
    else host.prepend(icon);
    scope.add(() => {
      if (existingIcon) icon.replaceWith(existingIcon);
      else icon.remove();
    });
  }
  const popup = document.createElement('div');
  popup.className = 'eui-search-view';
  popup.id = uniqueId('eui-search-results');
  popup.setAttribute('role', 'listbox');
  popup.setAttribute('aria-label', options.label + '建议');
  host.append(popup);
  scope.add(() => popup.remove());
  const status = document.createElement('span');
  status.className = 'eui-visually-hidden';
  status.setAttribute('role', 'status');
  host.append(status);
  scope.add(() => status.remove());
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'eui-search-clear';
  clear.setAttribute('aria-label', '清除搜索');
  clear.append(controlIcon('close'));
  host.append(clear);
  scope.add(() => clear.remove());
  const clearController = enhanceIconButton(clear, {
    motionScheme: options.motionScheme ?? 'expressive',
  });
  scope.add(() => clearController.destroy());
  const controller = overlay(popup, scope, {
    anchor: host,
    kind: 'tooltip',
    placement: 'bottom-start',
    restoreFocus: false,
    motionScheme: options.motionScheme ?? 'expressive',
  });
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', popup.id);
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-label', options.label);
  host.dataset.variant = options.variant ?? 'bar';
  let results: readonly SearchResult[] = [],
    active = -1,
    queryVersion = 0,
    request: AbortController | undefined,
    timer: ReturnType<typeof setTimeout> | undefined,
    composing = false,
    choosing = false;
  function render() {
    popup.replaceChildren();
    for (const [index, result] of results.entries()) {
      const item = document.createElement('div');
      item.id = `${popup.id}-${index}`;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(index === active));
      if (result.disabled) item.setAttribute('aria-disabled', 'true');
      item.textContent = result.label;
      item.dataset.index = String(index);
      popup.append(item);
    }
    if (active >= 0) input.setAttribute('aria-activedescendant', `${popup.id}-${active}`);
    else input.removeAttribute('aria-activedescendant');
    popup.style.minWidth = `${host.getBoundingClientRect().width}px`;
    clear.hidden = !input.value;
  }
  function close() {
    controller.close();
    input.setAttribute('aria-expanded', 'false');
    active = -1;
    input.removeAttribute('aria-activedescendant');
  }
  async function refresh() {
    if (scope.disposed) return;
    clearTimeout(timer);
    request?.abort();
    const version = ++queryVersion;
    request = new AbortController();
    try {
      const source = options.suggestions ?? [];
      const nextResults =
        typeof source === 'function'
          ? await source(input.value, { signal: request.signal })
          : source.filter((result) =>
              result.label.toLocaleLowerCase().includes(input.value.toLocaleLowerCase()),
            );
      if (scope.disposed || version !== queryVersion || request.signal.aborted) return;
      results = nextResults;
      active = -1;
      render();
      status.textContent = `${results.length} 条建议`;
      if (results.length && document.activeElement === input) {
        controller.open();
        input.setAttribute('aria-expanded', 'true');
      } else close();
    } catch (error) {
      if (scope.disposed || version !== queryVersion || request?.signal.aborted) return;
      status.textContent = '搜索建议暂不可用';
      close();
      emit(host, 'eui-error', { error });
    }
  }
  function choose(index: number) {
    const result = results[index];
    if (!result || result.disabled) return;
    choosing = true;
    input.value = result.value ?? result.label;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    choosing = false;
    close();
    clear.hidden = false;
    emit(host, 'eui-select', { result });
    input.focus();
  }
  scope.listen(input, 'input', () => {
    clear.hidden = !input.value;
    if (composing || choosing) return;
    clearTimeout(timer);
    request?.abort();
    queryVersion++;
    timer = setTimeout(() => void refresh(), options.debounce ?? 150);
  });
  scope.listen(input, 'compositionstart', () => {
    composing = true;
  });
  scope.listen(input, 'compositionend', () => {
    composing = false;
    void refresh();
  });
  scope.listen(input, 'focus', () => {
    host.dataset.focusVisible = String(input.matches(':focus-visible'));
  });
  scope.listen(input, 'blur', () => {
    host.dataset.focusVisible = 'false';
  });
  scope.listen(input, 'focus', () => void refresh());
  scope.listen(input, 'keydown', (event) => {
    const e = event as KeyboardEvent;
    if (e.isComposing) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!controller.isOpen) {
        void refresh();
        return;
      }
      const direction = e.key === 'ArrowDown' ? 1 : -1;
      for (let i = 0; i < results.length; i++) {
        active = (active + direction + results.length) % results.length;
        if (!results[active]!.disabled) break;
      }
      render();
      popup
        .querySelector<HTMLElement>('[aria-selected=true]')
        ?.scrollIntoView?.({ block: 'nearest' });
    } else if (e.key === 'Enter' && controller.isOpen && active >= 0) {
      e.preventDefault();
      choose(active);
    }
  });
  scope.listen(popup, 'pointerdown', (event) => event.preventDefault());
  scope.listen(popup, 'click', (event) => {
    const item = (event.target as Element).closest<HTMLElement>('[data-index]');
    if (item) choose(Number(item.dataset.index));
  });
  scope.listen(popup, 'eui-close', () => input.setAttribute('aria-expanded', 'false'));
  scope.listen(clear, 'click', () => {
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  });
  scope.listen(host, 'focusout', () =>
    queueMicrotask(() => {
      if (!host.contains(document.activeElement)) close();
    }),
  );
  scope.add(() => {
    clearTimeout(timer);
    request?.abort();
    queryVersion++;
  });
  render();
  return {
    element: host,
    input,
    refresh,
    close,
    update(next: Partial<SearchOptions>) {
      options = { ...options, ...next };
      clearController.update({ motionScheme: options.motionScheme ?? 'expressive' });
      input.setAttribute('aria-label', options.label);
      host.dataset.variant = options.variant ?? 'bar';
      void refresh();
    },
    destroy() {
      scope.dispose();
    },
  };
}
