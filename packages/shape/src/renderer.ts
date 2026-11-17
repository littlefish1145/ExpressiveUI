import { detectCapabilities } from '@epui/core';
import { contourPath } from './geometry.js';
import { cubicPath, sampleCubics } from './cubic.js';
export type ShapeBackend = 'svg' | 'clip-path' | 'css-shape' | 'svg-clip' | 'svg-mask';
const NS = 'http://www.w3.org/2000/svg';
let nextId = 0;
export function createShapeRenderer(host: HTMLElement, requested: ShapeBackend = 'svg') {
  const caps = detectCapabilities();
  const backend: ShapeBackend =
    (requested === 'clip-path' && !caps.clipPath) || (requested === 'css-shape' && !caps.cssShape)
      ? 'svg'
      : requested;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 1000 1000');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('eui-shape');
  svg.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none';
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('fill', 'currentColor');
  let surface: HTMLElement | undefined;
  if (backend === 'clip-path' || backend === 'css-shape') {
    surface = document.createElement('span');
    surface.setAttribute('aria-hidden', 'true');
    surface.style.cssText = 'position:absolute;inset:0;background:currentColor;pointer-events:none';
    host.prepend(surface);
  } else if (backend === 'svg-clip' || backend === 'svg-mask') {
    const id = `eui-shape-${++nextId}`;
    const defs = document.createElementNS(NS, 'defs');
    const definition = document.createElementNS(NS, backend === 'svg-clip' ? 'clipPath' : 'mask');
    definition.id = id;
    if (backend === 'svg-clip') definition.setAttribute('clipPathUnits', 'userSpaceOnUse');
    else {
      definition.setAttribute('maskUnits', 'userSpaceOnUse');
      definition.setAttribute('x', '0');
      definition.setAttribute('y', '0');
      definition.setAttribute('width', '1000');
      definition.setAttribute('height', '1000');
      path.setAttribute('fill', 'white');
    }
    definition.append(path);
    defs.append(definition);
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('width', '1000');
    rect.setAttribute('height', '1000');
    rect.setAttribute('fill', 'currentColor');
    rect.setAttribute(backend === 'svg-clip' ? 'clip-path' : 'mask', `url(#${id})`);
    svg.append(defs, rect);
    host.prepend(svg);
  } else {
    svg.append(path);
    host.prepend(svg);
  }
  let destroyed = false;
  let insetPath: SVGPathElement | undefined;
  let samples = new Float64Array(0);
  return {
    backend,
    element: surface ?? svg,
    draw(points: ArrayLike<number>) {
      if (destroyed) return;
      if (surface) {
        const coords: string[] = [];
        for (let i = 0; i < points.length; i += 2)
          coords.push(`${(points[i]! * 100).toFixed(4)}% ${(points[i + 1]! * 100).toFixed(4)}%`);
        surface.style.clipPath =
          backend === 'css-shape'
            ? `shape(from ${coords[0]}, ${coords
                .slice(1)
                .map((c) => 'line to ' + c)
                .join(', ')}, close)`
            : `polygon(${coords.join(',')})`;
      } else {
        const d = contourPath(points);
        path.setAttribute('d', d);
        insetPath?.setAttribute('d', d);
      }
    },
    drawCubics(cubics: ArrayLike<number>) {
      if (destroyed) return;
      if (surface && backend === 'css-shape') {
        let shape = `shape(from ${(cubics[0]! * 100).toFixed(6)}% ${(cubics[1]! * 100).toFixed(6)}%`;
        for (let i = 0; i < cubics.length; i += 8)
          shape += `, curve to ${(cubics[i + 6]! * 100).toFixed(6)}% ${(cubics[i + 7]! * 100).toFixed(6)}% with ${(cubics[i + 2]! * 100).toFixed(6)}% ${(cubics[i + 3]! * 100).toFixed(6)}% / ${(cubics[i + 4]! * 100).toFixed(6)}% ${(cubics[i + 5]! * 100).toFixed(6)}%`;
        surface.style.clipPath = shape + ', close)';
      } else if (surface) {
        const count = Math.max(512, Math.min(8192, (cubics.length / 8) * 24));
        if (samples.length !== count * 2) samples = new Float64Array(count * 2);
        this.draw(sampleCubics(cubics, count, samples));
      } else {
        const d = cubicPath(cubics);
        path.setAttribute('d', d);
        insetPath?.setAttribute('d', d);
      }
    },
    insetStroke(width: number) {
      if (backend !== 'svg') return;
      if (!insetPath) {
        const defs = document.createElementNS(NS, 'defs'),
          clip = document.createElementNS(NS, 'clipPath');
        clip.id = `eui-inset-${++nextId}`;
        clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
        insetPath = document.createElementNS(NS, 'path');
        insetPath.style.fill = 'white';
        insetPath.style.stroke = 'none';
        clip.append(insetPath);
        defs.append(clip);
        svg.append(defs);
        path.setAttribute('clip-path', `url(#${clip.id})`);
      }
      path.style.strokeWidth = `${width * 2}px`;
      path.style.vectorEffect = 'non-scaling-stroke';
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      svg.remove();
      surface?.remove();
    },
  };
}
