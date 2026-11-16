/** Keep the full catalog in the initial HTML so lazy hydration never hides demos. */
export function renderPlaygroundCatalog(html: string, catalog: string, extensions: string) {
  const marker = '<!-- component-catalog -->';
  if (html.split(marker).length !== 2)
    throw new Error('Playground must contain exactly one component-catalog marker');
  if (!/<\/div>\s*$/.test(catalog)) throw new Error('Missing catalog grid closing tag');
  const content = catalog.replace(/<\/div>\s*$/, extensions + '</div>');
  return html.replace(
    marker,
    `<section id="component-catalog" class="catalog-section" aria-label="完整组件目录">${content}</section>`,
  );
}
