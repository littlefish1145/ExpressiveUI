import { Window } from 'happy-dom';
import { build } from 'esbuild';
const result = await build({
  entryPoints: ['packages/components/src/styles.css'],
  bundle: true,
  write: false,
});
const window = new Window();
const style = window.document.createElement('style');
style.textContent = result.outputFiles[0].text;
window.document.head.append(style);
const button = window.document.createElement('button');
button.className = 'eui-button';
button.dataset.variant = 'filled';
window.document.body.append(button);
const surface = window.document.createElement('span');
surface.className = 'eui-surface';
button.append(surface);
console.log({
  color: window.getComputedStyle(button).color,
  background: window.getComputedStyle(surface).color,
  primary: window
    .getComputedStyle(window.document.documentElement)
    .getPropertyValue('--md-sys-color-primary'),
});
await window.happyDOM.close();
