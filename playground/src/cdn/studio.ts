import examples from './generated/examples.json';
import { cdnDocument } from './examples.js';
const documents: Record<string, { html: string; css: string; script: string }> = examples;
export function studioCdnExample(page: string, symbol = '', origin = location.origin) {
  const example = documents[page + (page === 'adapter-react/index' && symbol ? ':' + symbol : '')];
  if (!example) throw Error('CDN example is missing: ' + page);
  return cdnDocument(example.html, example.css, example.script, origin);
}
