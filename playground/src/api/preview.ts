import runtime from './generated/runtime.json';
export interface PreviewPayload {
  mode: 'html' | 'react';
  code: string;
  html: string;
  css: string;
  seed: string;
  dark: boolean;
}
export function createPreview(
  stage: HTMLElement,
  status: HTMLElement,
  error: HTMLElement,
  consoleOutput: HTMLElement,
) {
  const consoleLines: string[] = [];
  let assets: Promise<{ js: string; css: string }> | undefined;
  function loadAssets() {
    assets ??= Promise.all(
      ['api-runtime.js', 'api-runtime.css'].map(async (name) => {
        const response = await fetch(`/${name}?v=${runtime.hash}`, { credentials: 'same-origin' });
        if (!response.ok || response.headers.get('content-type')?.includes('text/html'))
          throw Error('预览资源加载失败，请刷新页面确认登录状态');
        return response.text();
      }),
    )
      .then(([js, css]) => ({
        js: js!,
        css: css! + '\n#preview-root { display: flow-root; min-width: 0; }',
      }))
      .catch((error) => {
        assets = undefined;
        throw error;
      });
    return assets;
  }
  // Inline only serialized string literals: no runtime bytes become HTML markup.
  const literal = (value: unknown) =>
    JSON.stringify(value).replaceAll('<', String.fromCharCode(92) + 'u003c');
  let iframe: HTMLIFrameElement | undefined,
    token = '',
    disposed = false;
  let worker: Worker | undefined,
    request = 0,
    active = 0;
  const pending = new Map<
    number,
    { resolve: (code: string) => void; reject: (reason: Error) => void }
  >();
  function compile(source: string, react: boolean) {
    worker ??= new Worker(new URL('./compiler.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event) => {
      const item = pending.get(event.data.id);
      if (!item) return;
      pending.delete(event.data.id);
      if (event.data.error) item.reject(Error(event.data.error));
      else item.resolve(event.data.code);
    };
    worker.onerror = (event) => {
      for (const item of pending.values()) item.reject(Error(event.message));
      pending.clear();
    };
    return new Promise<string>((resolve, reject) => {
      const id = ++request;
      pending.set(id, { resolve, reject });
      worker!.postMessage({ id, source, react });
    });
  }
  const post = (type: string, data: unknown) =>
    iframe?.contentWindow?.postMessage({ channel: 'eui-preview', token, type, data }, '*');
  let payload: PreviewPayload | undefined;
  const onMessage = async (event: MessageEvent) => {
    if (
      disposed ||
      event.source !== iframe?.contentWindow ||
      event.data?.channel !== 'eui-preview' ||
      event.data.token !== token
    )
      return;
    const currentToken = token,
      { type, data } = event.data;
    if (type === 'boot' && payload) {
      post('run', payload);
      status.textContent = '正在挂载示例…';
    }
    if (type === 'ready')
      status.textContent =
        iframe?.title === 'CDN HTML 在线预览'
          ? 'CDN 已加载 · 沙盒 iframe · 可直接交互'
          : '预览已运行 · 沙盒 iframe · 可直接交互';
    if (type === 'resize' && iframe && typeof data === 'number' && Number.isFinite(data)) {
      iframe.style.height = `${Math.max(360, Math.min(800, data))}px`;
    }
    if (type === 'console') {
      consoleLines.push(`[${String(data?.level)}] ${String(data?.text).slice(0, 5000)}`);
      if (consoleLines.length > 100) consoleLines.shift();
      consoleOutput.textContent = consoleLines.join('\n');
    }
    if (type === 'error') {
      error.hidden = false;
      error.textContent = String(data);
      status.textContent = '示例运行出错，修改后可重跑';
    }
    if (type === 'morph') {
      try {
        if (
          typeof data?.key !== 'string' ||
          !/^[a-zA-Z0-9]+\|[a-zA-Z0-9]+$/.test(data.key) ||
          !Number.isSafeInteger(data.id)
        )
          throw Error('Invalid morph request');
        const { prepareMorphData } = await import('../../../packages/shape/src/official-morph.js');
        const pair = await prepareMorphData(data.key);
        if (token === currentToken) post('morph-result', { id: data.id, pair });
      } catch (reason) {
        if (token === currentToken) post('morph-result', { id: data.id, error: String(reason) });
      }
    }
  };
  window.addEventListener('message', onMessage);
  function clear() {
    consoleLines.length = 0;
    consoleOutput.textContent = '';
    post('dispose', {});
    iframe?.remove();
    iframe = undefined;
    stage.replaceChildren();
    payload = undefined;
  }
  return {
    async runDocument(html: string) {
      ++active;
      clear();
      error.hidden = true;
      error.textContent = '';
      token = crypto.randomUUID();
      iframe = document.createElement('iframe');
      iframe.title = 'CDN HTML 在线预览';
      iframe.sandbox.add('allow-scripts');
      const host = location.origin;
      const csp = `default-src 'none'; script-src 'unsafe-inline' ${host}; style-src 'unsafe-inline' ${host}; font-src ${host} data:; img-src data: blob: ${host}; connect-src ${host}; base-uri 'none'`;
      const bridge = `<meta http-equiv="Content-Security-Policy" content="${csp}"><script>
const send=(type,data)=>parent.postMessage({channel:'eui-preview',token:${literal(token)},type,data},${literal(host)});
let failed=false;
addEventListener('error',event=>{failed=true;send('error',event.message||'CDN 资源加载失败');},true);
addEventListener('unhandledrejection',event=>{failed=true;send('error',String(event.reason));});
addEventListener('eui-error',event=>{failed=true;send('error',String(event.detail.error));});
for(const level of ['log','info','warn','error']){const original=console[level];console[level]=(...args)=>{original.apply(console,args);send('console',{level,text:args.map(String).join(' ')});};}
addEventListener('load',()=>{
 if(!failed)send('ready');
 const observer=new ResizeObserver(()=>send('resize',document.body.getBoundingClientRect().height+56));
 observer.observe(document.body);
});
</script>`;
      iframe.srcdoc = /<head(?:\s[^>]*)?>/i.test(html)
        ? html.replace(/<head(?:\s[^>]*)?>/i, (head) => head + bridge)
        : bridge + html;
      stage.append(iframe);
      status.textContent = '正在加载 CDN JS 与 CSS…';
    },
    async run(input: Omit<PreviewPayload, 'code'> & { source: string }) {
      const id = ++active;
      error.hidden = true;
      error.textContent = '';
      status.textContent = '正在编译 ' + (input.mode === 'react' ? 'TSX' : 'TypeScript') + '…';
      try {
        const [code, loaded] = await Promise.all([
          compile(input.source, input.mode === 'react'),
          loadAssets(),
        ]);
        if (disposed || id !== active) return;
        clear();
        token = crypto.randomUUID();
        payload = {
          mode: input.mode,
          html: input.html,
          css: input.css,
          seed: input.seed,
          dark: input.dark,
          code,
        };
        const origin = location.origin;
        iframe = document.createElement('iframe');
        iframe.title =
          input.mode === 'react' ? 'React 示例在线预览' : 'HTML 与 TypeScript 示例在线预览';
        iframe.sandbox.add('allow-scripts');
        const csp =
          "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; font-src data:; img-src data: blob:; connect-src 'none'; base-uri 'none'";
        iframe.srcdoc = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><style id="base-css"></style><style id="user-css"></style></head><body><div id="preview-root"></div><script>globalThis.__euiSession=${literal({ token, parentOrigin: origin })};document.getElementById('base-css').textContent=${literal(loaded.css)};new Function(${literal(loaded.js)})();</script></body></html>`;
        stage.append(iframe);
        status.textContent = '正在加载本地预览运行时…';
      } catch (reason) {
        if (id === active && !disposed) {
          error.hidden = false;
          error.textContent = String(reason);
          status.textContent = '编译失败 · 请检查当前代码';
        }
      }
    },
    clear() {
      ++active;
      clear();
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      active++;
      clear();
      worker?.terminate();
      for (const item of pending.values()) item.reject(Error('Editor disposed'));
      pending.clear();
      window.removeEventListener('message', onMessage);
    },
  };
}
