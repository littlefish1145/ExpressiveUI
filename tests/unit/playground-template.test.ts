import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderPlaygroundCatalog } from '../../scripts/playground-template';

it('renders every demo group in visible initial HTML, including extensions', () => {
  const html = renderPlaygroundCatalog(
    readFileSync('playground/index.html', 'utf8'),
    readFileSync('playground/src/catalog.html', 'utf8'),
    readFileSync('playground/src/extensions.html', 'utf8'),
  );
  const page = new DOMParser().parseFromString(html, 'text/html');
  const catalog = page.querySelector('#component-catalog')!;
  expect(catalog.hasAttribute('hidden')).toBe(false);
  expect(page.querySelectorAll('#component-catalog')).toHaveLength(1);
  expect(page.querySelectorAll('.demo-card')).toHaveLength(28);
  for (const id of ['catalog-name', 'catalog-tabs', 'catalog-range', 'extension-table'])
    expect(catalog.querySelector('#' + id)).not.toBeNull();
  expect(page.querySelector('.nav-count')?.textContent).toBe('全部');
});

it('fails the build when the catalog marker disappears or is duplicated', () => {
  expect(() =>
    renderPlaygroundCatalog('<div id="component-catalog" hidden></div>', '<div></div>', ''),
  ).toThrow('exactly one');
  expect(() =>
    renderPlaygroundCatalog(
      '<!-- component-catalog --><!-- component-catalog -->',
      '<div></div>',
      '',
    ),
  ).toThrow('exactly one');
});
