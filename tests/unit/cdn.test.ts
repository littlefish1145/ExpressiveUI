import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  init,
  destroy,
  getController,
  startAutoInit,
  stopAutoInit,
} from '../../playground/src/cdn/auto.js';
import { declarative, cdnDocument } from '../../playground/src/cdn/examples.js';
import { studioCdnExample } from '../../playground/src/cdn/studio.js';
import { activeAnimationCount } from '@epui/motion';

beforeEach(() => {
  const query = new EventTarget() as MediaQueryList;
  Object.defineProperty(query, 'matches', { value: true });
  vi.stubGlobal('matchMedia', () => query);
});
afterEach(() => {
  stopAutoInit();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  expect(activeAnimationCount()).toBe(0);
});

describe('CDN declarative components', () => {
  it.each(Object.entries(declarative))(
    'initializes the %s Studio example without errors',
    (_, html) => {
      document.body.innerHTML = html;
      const errors: unknown[] = [];
      document.body.addEventListener(
        'eui-error',
        (event) => errors.push((event as CustomEvent).detail.error),
        { once: true },
      );
      init();
      expect(errors.map(String)).toEqual([]);
      const nodes = [...document.querySelectorAll<HTMLElement>('[data-eui]')];
      expect(nodes.length).toBeGreaterThan(0);
      for (const node of nodes) expect(getController(node)).toBeDefined();
      destroy();
      for (const node of nodes) expect(getController(node)).toBeUndefined();
    },
  );

  it('is idempotent, preserves native markup and supports reinitialization', () => {
    document.body.innerHTML =
      '<button data-eui="button" data-variant="tonal" data-size="md">Save</button>';
    const button = document.querySelector('button')!;
    init(button);
    const first = getController(button);
    init();
    expect(getController(button)).toBe(first);
    expect(button.dataset.variant).toBe('tonal');
    destroy(button);
    expect(button.className).toBe('');
    expect(button.textContent).toBe('Save');
    init(button);
    expect(getController(button)).not.toBe(first);
  });

  it('initializes dynamic content, keeps moved controls and disposes removed ones', async () => {
    startAutoInit();
    const button = document.createElement('button');
    button.dataset.eui = 'button';
    document.body.append(button);
    await vi.waitFor(() => expect(getController(button)).toBeDefined());
    const first = getController(button);
    const container = document.createElement('div');
    document.body.append(container);
    container.append(button);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(getController(button)).toBe(first);
    container.remove();
    await vi.waitFor(() => expect(getController(button)).toBeUndefined());
  });

  it('reports malformed options without blocking neighboring components', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    document.body.innerHTML =
      '<button data-eui="button" data-eui-options="[]">Bad</button><button data-eui="button">Good</button>';
    init();
    expect(getController(document.querySelectorAll('button')[0]!)).toBeUndefined();
    expect(getController(document.querySelectorAll('button')[1]!)).toBeDefined();
    expect(log).toHaveBeenCalledOnce();
  });

  it('disposes detached controls when stopped before the mutation observer runs', () => {
    document.body.innerHTML = '<button data-eui="button">Save</button>';
    startAutoInit();
    const button = document.querySelector('button')!;
    button.remove();
    stopAutoInit();
    expect(getController(button)).toBeUndefined();
    expect(button.className).toBe('');
  });
});

describe('CDN documents', () => {
  it('exports a simple button as plain HTML with just two CDN references', () => {
    const html = studioCdnExample('components/button', '', 'https://example.com');
    expect(html).toContain('https://example.com/cdn/expressive-ui.js');
    expect(html).toContain('data-eui="button"');
    expect(html).not.toContain('function mount');
    expect(html).not.toContain('import ');
  });
  it('retains the manual API for logic that needs callbacks', () => {
    const html = studioCdnExample('components/data-table', '', 'https://example.com');
    expect(html).toContain('ExpressiveUI.components');
    expect(html).toContain('enhanceDataTable');
    expect(html).not.toContain('row:');
    expect(html).not.toContain('export async');
  });
  it('prevents inline content from terminating script or style elements', () => {
    const html = cdnDocument('', '/* </style> */', 'console.log("</script>")');
    expect(html.match(/<\/script>/g)).toHaveLength(2);
    expect(html.match(/<\/style>/g)).toHaveLength(1);
  });
});
