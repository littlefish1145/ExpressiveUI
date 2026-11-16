const NS = 'http://www.w3.org/2000/svg';
/** Small built-in control icons, drawn on a consistent 24-unit grid. */
export function controlIcon(
  name: 'search' | 'close' | 'calendar' | 'clock' | 'previous' | 'next',
  size = 24,
) {
  const paths = {
    search: 'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM16 16l5 5',
    close: 'm6 6 12 12M6 18 18 6',
    calendar:
      'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM7 3v4M17 3v4M3 10h18M7 14h2m3 0h2m3 0h0M7 17h2m3 0h2',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l4 2',
    previous: 'm14 6-6 6 6 6',
    next: 'm10 6 6 6-6 6',
  };
  const svg = svgElement('svg', {
    viewBox: '0 0 24 24',
    width: size,
    height: size,
    'aria-hidden': 'true',
    focusable: 'false',
  });
  svg.append(
    svgElement('path', {
      d: paths[name],
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
  );
  return svg;
}
export function svgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number> = {},
) {
  const element = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}
/** A geometric chevron: independent of the UI font's glyph metrics and baseline. */
export function createChevronDown(size = 20) {
  const svg = svgElement('svg', {
    viewBox: '0 0 24 24',
    width: size,
    height: size,
    'aria-hidden': 'true',
    focusable: 'false',
  });
  svg.append(
    svgElement('path', {
      d: 'm7 10 5 5 5-5',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
  );
  return svg;
}
