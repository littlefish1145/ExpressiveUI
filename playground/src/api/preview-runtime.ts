import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import * as jsxRuntime from 'react/jsx-runtime';
import * as core from '@amiracle1024/core';
import * as tokens from '@amiracle1024/tokens';
import * as shape from '@amiracle1024/shape';
import * as motion from '@amiracle1024/motion';
import * as theme from '@amiracle1024/theme';
import * as themeRuntime from '@amiracle1024/theme/runtime';
import * as shapeGeometry from '../../../packages/shape/src/geometry.js';
import * as shapeRenderer from '../../../packages/shape/src/renderer.js';
import * as shapeLibrary from '../../../packages/shape/src/library.js';
import * as components from '@amiracle1024/components';
import * as adapter from '@amiracle1024/adapter-react';
declare global {
  var __euiSession: { token: string; parentOrigin: string };
  var __euiLoadMorph: (key: string) => Promise<readonly [readonly number[], readonly number[]]>;
}
const session = globalThis.__euiSession;
const send = (type: string, data: unknown = {}) =>
  parent.postMessage(
    { channel: 'eui-preview', token: session.token, type, data },
    session.parentOrigin,
  );
const printable = (value: unknown) => {
  if (typeof value === 'string') return value;
  try {
    return (
      JSON.stringify(value, (_, item) => (typeof item === 'bigint' ? String(item) : item)) ??
      String(value)
    );
  } catch {
    return String(value);
  }
};
for (const level of ['log', 'info', 'warn', 'error'] as const) {
  const original = console[level].bind(console);
  console[level] = (...values: unknown[]) => {
    original(...values);
    send('console', { level, text: values.map(printable).join(' ') });
  };
}
let cleanup: (() => void) | undefined;
let reactRoot: ReturnType<typeof ReactDOM.createRoot> | undefined;
let request = 0;
const pending = new Map<
  number,
  {
    resolve: (data: readonly [readonly number[], readonly number[]]) => void;
    reject: (error: Error) => void;
  }
>();
globalThis.__euiLoadMorph = (key) =>
  new Promise((resolve, reject) => {
    const id = ++request;
    pending.set(id, { resolve, reject });
    send('morph', { id, key });
  });
const modules: Record<string, unknown> = {
  react: React,
  'react-dom/client': ReactDOM,
  'react/jsx-runtime': jsxRuntime,
  '@amiracle1024/core': core,
  '@amiracle1024/tokens': tokens,
  '@amiracle1024/shape': shape,
  '@amiracle1024/motion': motion,
  '@amiracle1024/theme': theme,
  '@amiracle1024/theme/runtime': themeRuntime,
  '@amiracle1024/shape/geometry': shapeGeometry,
  '@amiracle1024/shape/renderer': shapeRenderer,
  '@amiracle1024/shape/library': shapeLibrary,
  '@amiracle1024/components/styles.css': {},
  '@amiracle1024/components/fonts.css': {},
  '@amiracle1024/components': components,
  '@amiracle1024/adapter-react': adapter,
};
for (const [key, value] of Object.entries(modules))
  modules[key] = Object.assign({ default: value }, value);
const root = document.getElementById('preview-root')!;
// Report content height rather than the viewport height, so the frame can shrink too.
let heightFrame = 0;
const sizeObserver = new ResizeObserver(() => {
  cancelAnimationFrame(heightFrame);
  heightFrame = requestAnimationFrame(() => {
    const bodyStyle = getComputedStyle(document.body);
    send(
      'resize',
      Math.ceil(
        root.getBoundingClientRect().height +
          parseFloat(bodyStyle.paddingTop || '0') +
          parseFloat(bodyStyle.paddingBottom || '0') +
          parseFloat(bodyStyle.marginTop || '0') +
          parseFloat(bodyStyle.marginBottom || '0'),
      ),
    );
  });
});
sizeObserver.observe(root);
addEventListener('pagehide', () => {
  sizeObserver.disconnect();
  cancelAnimationFrame(heightFrame);
});
const dispose = () => {
  reactRoot?.unmount();
  reactRoot = undefined;
  cleanup?.();
  cleanup = undefined;
};
addEventListener('pagehide', dispose);
addEventListener('error', (event) => send('error', event.message));
addEventListener('unhandledrejection', (event) => send('error', String(event.reason)));
addEventListener('message', async (event) => {
  if (
    event.source !== parent ||
    event.origin !== session.parentOrigin ||
    event.data?.token !== session.token ||
    event.data.channel !== 'eui-preview'
  )
    return;
  const { type, data } = event.data;
  if (type === 'morph-result') {
    const item = pending.get(data.id);
    if (item) {
      pending.delete(data.id);
      if (data.error) item.reject(Error(data.error));
      else item.resolve(data.pair);
    }
    return;
  }
  if (type === 'dispose') {
    dispose();
    return;
  }
  if (type !== 'run') return;
  try {
    dispose();
    root.replaceChildren();
    document.getElementById('user-css')!.textContent = data.css;
    if (data.seed) {
      const pair = {
        light: theme.generateTheme({ seed: data.seed }),
        dark: theme.generateTheme({ seed: data.seed, dark: true }),
      };
      const controller = theme.createThemeController(
        document.documentElement,
        pair,
        data.dark ? 'dark' : 'light',
      );
      cleanup = () => controller.destroy();
    }
    const exports: Record<string, unknown> = {};
    const require = (id: string) => {
      if (!Object.hasOwn(modules, id))
        throw Error(`编辑器未内置模块 ${id}。请使用文档列出的库、React 或浏览器原生 API。`);
      return modules[id];
    };
    new Function('require', 'exports', 'module', data.code)(require, exports, { exports });
    if (data.mode === 'react') {
      if (typeof exports.default !== 'function')
        throw Error('React 示例需要 export default function App()');
      reactRoot = ReactDOM.createRoot(root, {
        onUncaughtError: (error) =>
          send('error', error instanceof Error ? (error.stack ?? error.message) : String(error)),
      });
      reactRoot.render(React.createElement(exports.default as React.FunctionComponent));
    } else {
      root.innerHTML = data.html;
      if (typeof exports.mount !== 'function')
        throw Error('TypeScript 示例需要 export function mount(root)');
      const release = await (exports.mount as (root: HTMLElement) => unknown)(root);
      const previous = cleanup;
      cleanup = () => {
        if (typeof release === 'function') release();
        previous?.();
      };
    }
    send('ready');
  } catch (error) {
    send('error', error instanceof Error ? (error.stack ?? error.message) : String(error));
  }
});
send('boot');
