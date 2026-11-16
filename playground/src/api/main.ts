import '../../../packages/components/src/styles.css';
import './studio.css';
import index from './generated/index.json';
import { Scope } from '@amiracle1024/core';
import { createThemeController, generateTheme } from '@amiracle1024/theme';
import { enhanceButton, enhanceSelect, enhanceSwitch, enhanceTabs } from '@amiracle1024/components';
import { EditorView, keymap } from '@codemirror/view';
import { Compartment, EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { css as cssLanguage } from '@codemirror/lang-css';
import { html as htmlLanguage } from '@codemirror/lang-html';
import { closeBrackets } from '@codemirror/autocomplete';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as tags } from '@lezer/highlight';
import {
  defaultKeymap,
  history as historyExtension,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands';
import { exampleFor } from './examples.js';
import type { Example } from './examples.js';
import type { ApiPage, ApiSymbol, Member } from './models.js';
import { createPreview } from './preview.js';
import { studioCdnExample } from '../cdn/studio.js';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const scope = new Scope(),
  preview = createPreview(
    $('preview-stage'),
    $('preview-status'),
    $('preview-error'),
    $('preview-console'),
  );
scope.add(() => preview.destroy());
const system = matchMedia('(prefers-color-scheme:dark)');
const dark = $<HTMLInputElement>('docs-dark');
dark.checked = system.matches;
const themes = {
  light: generateTheme({ seed: '#6750a4' }),
  dark: generateTheme({ seed: '#6750a4', dark: true }),
};
const theme = createThemeController(
  document.documentElement,
  themes,
  system.matches ? 'dark' : 'light',
);
scope.add(() => theme.destroy());
const titles: Record<string, string> = {
  'adapter-react': 'React adapters',
  core: 'Core',
  tokens: 'Design tokens',
  shape: 'Shape engine',
  motion: 'Motion engine',
  theme: 'Theme engine',
  components: 'Components',
  styles: 'CSS & Events',
};
const nice = (name: string) =>
  name === 'index'
    ? 'Overview'
    : name.replace(
        /(^|-)([a-z])/g,
        (_, prefix: string, letter: string) => (prefix ? ' ' : '') + letter.toUpperCase(),
      );
const loaders = import.meta.glob('./generated/*.json');
function renderNav() {
  const query = $<HTMLInputElement>('api-search').value.trim().toLowerCase();
  const nav = $('api-nav');
  nav.replaceChildren();
  let shown = 0;
  for (const group of [
    'components',
    'adapter-react',
    'core',
    'tokens',
    'shape',
    'motion',
    'theme',
    'styles',
  ]) {
    const pages = index.filter(
      (item) =>
        item.package === group &&
        (!query || `${item.module} ${item.symbols.join(' ')}`.toLowerCase().includes(query)),
    );
    if (!pages.length) continue;
    const heading = document.createElement('h2');
    heading.className = 'api-nav-heading';
    heading.textContent = titles[group]!;
    nav.append(heading);
    for (const item of pages) {
      const link = document.createElement('a');
      link.className = 'api-nav-link';
      link.href = '#/' + item.id;
      link.textContent = nice(item.module);
      if (item.id === page?.id) link.setAttribute('aria-current', 'page');
      nav.append(link);
      shown++;
    }
  }
  $('api-count').textContent =
    `${shown} / ${index.length} 个独立页面 · ${index.filter((item) => item.package !== 'styles').reduce((n, item) => n + item.symbols.length, 0)} 个真实导出`;
}
let page: ApiPage | undefined,
  selected: ApiSymbol | undefined,
  mode: 'html' | 'react' | 'cdn' = 'html',
  file: 'html' | 'ts' | 'react' | 'css' | 'cdn' = 'ts';
let draft: Example | undefined,
  loadRequest = 0,
  runTimer: ReturnType<typeof setTimeout> | undefined,
  memberScope = new Scope();
scope.add(() => memberScope.dispose());
scope.add(() => clearTimeout(runTimer));
const storageKey = () =>
  `expressive-api-v1:${page?.id}${page?.package === 'adapter-react' ? ':' + selected?.name : ''}`;
function save() {
  if (!draft || !page) return;
  try {
    localStorage.setItem(storageKey(), JSON.stringify(draft));
  } catch {
    $('code-state').textContent = '本地存储不可用，当前编辑仍可运行';
  }
}

/* ------------------------------------------------------------------ */
/* Expressive UI controls: every static control uses the library itself */
/* ------------------------------------------------------------------ */
const runButtonController = enhanceButton($('run-example'), { variant: 'filled', size: 'md' });
scope.add(runButtonController.destroy);
for (const [id, variant] of [
  ['copy-code', 'text'],
  ['reset-example', 'text'],
  ['download-example', 'text'],
] as const)
  scope.add(enhanceButton($(id), { variant, size: 'md' }).destroy);
scope.add(enhanceSwitch(dark).destroy);
scope.add(enhanceSwitch($('auto-run')).destroy);
scope.add(enhanceSelect($('api-symbol'), { label: '导出符号', variant: 'outlined' }).destroy);
const modeTabs = enhanceTabs($('mode-tabs'), { label: '示例框架', variant: 'secondary' });
scope.add(modeTabs.destroy);

/* ------------------------------------------------------------------ */
/* Code editor with real syntax highlighting (CodeMirror 6)             */
/* ------------------------------------------------------------------ */
const language = new Compartment();
const fileLanguages = {
  html: () => htmlLanguage(),
  ts: () => javascript({ typescript: true }),
  react: () => javascript({ jsx: true, typescript: true }),
  css: () => cssLanguage(),
  cdn: () => htmlLanguage(),
} as const;
const fileLabels = {
  html: 'HTML · 语义结构',
  ts: 'TypeScript · export mount(root)',
  react: 'React TSX · export default App',
  css: 'CSS · 只影响预览',
  cdn: 'HTML · 直接引用 CDN · 保存为 .html 即可使用',
} as const;
function autoRunMaybe() {
  if ($<HTMLInputElement>('auto-run').checked) {
    clearTimeout(runTimer);
    runTimer = setTimeout(run, 700);
  }
}
const editor = new EditorView({
  parent: $('api-editor-host'),
  state: EditorState.create({
    doc: '',
    extensions: [
      EditorView.lineWrapping,
      EditorView.theme({
        '&': { height: '100%', fontSize: '13px' },
        '.cm-scroller': {
          fontFamily: 'Consolas, "Courier New", monospace',
          lineHeight: '1.7',
          overflow: 'auto',
        },
        '.cm-content': { padding: '12px 18px', tabSize: '2' },
        '.cm-line': { padding: '0' },
        '&.cm-focused': { outline: 'none' },
      }),
      language.of(fileLanguages.ts()),
      historyExtension(),
      closeBrackets(),
      syntaxHighlighting(
        HighlightStyle.define([
          {
            tag: [tags.keyword, tags.atom, tags.modifier, tags.self, tags.null],
            class: 'cm-keyword',
          },
          { tag: [tags.string, tags.special(tags.string), tags.regexp], class: 'cm-string' },
          { tag: [tags.number, tags.bool], class: 'cm-number' },
          {
            tag: [
              tags.function(tags.variableName),
              tags.function(tags.propertyName),
              tags.definition(tags.variableName),
            ],
            class: 'cm-def',
          },
          { tag: [tags.propertyName, tags.attributeName], class: 'cm-property' },
          { tag: [tags.typeName, tags.className, tags.tagName], class: 'cm-tag' },
          {
            tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment],
            class: 'cm-comment',
          },
          {
            tag: [
              tags.operator,
              tags.punctuation,
              tags.bracket,
              tags.paren,
              tags.brace,
              tags.separator,
            ],
            class: 'cm-operator',
          },
          { tag: tags.invalid, class: 'cm-invalid' },
        ]),
        { fallback: true },
      ),
      keymap.of([
        {
          key: 'Mod-Enter',
          preventDefault: true,
          run: () => (run(), true),
        },
        ...historyKeymap,
        ...defaultKeymap,
        indentWithTab,
      ]),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged || !draft) return;
        draft[file] = update.state.doc.toString();
        save();
        $('code-state').textContent = '有修改 · Ctrl / ⌘ + Enter 运行';
        autoRunMaybe();
      }),
    ],
  }),
});
scope.add(() => editor.destroy());
function loadEditor(fileKey: typeof file) {
  editor.dispatch({
    changes: { from: 0, to: editor.state.doc.length, insert: draft![fileKey] ?? '' },
    effects: language.reconfigure(fileLanguages[fileKey]()),
  });
}

/* ------------------------------------------------------------------ */
/* File tabs rendered with enhanceTabs (spring indicator + ripple)      */
/* ------------------------------------------------------------------ */
let codeTabs: ReturnType<typeof enhanceTabs> | undefined,
  codeTabsMode: 'html' | 'react' | 'cdn' | '' = '';
const modeFile = () => (mode === 'cdn' ? 'cdn' : mode === 'react' ? 'react' : 'ts');
function buildCodeTabs() {
  codeTabs?.destroy();
  const tabs = $('code-tabs');
  tabs.replaceChildren();
  for (const name of mode === 'html'
    ? (['html', 'ts', 'css'] as const)
    : mode === 'cdn'
      ? (['cdn'] as const)
      : (['react', 'css'] as const)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.tab = name;
    const label = document.createElement('span');
    label.dataset.label = '';
    label.textContent = {
      html: 'HTML',
      ts: 'TypeScript',
      react: 'React TSX',
      css: 'CSS',
      cdn: 'index.html',
    }[name];
    button.append(label);
    if (name === file) button.setAttribute('aria-selected', 'true');
    tabs.append(button);
  }
  codeTabs = enhanceTabs(tabs, { label: '代码文件', selected: file });
  codeTabsMode = mode;
}
function showFile(next: typeof file) {
  if (!draft) return;
  file = next;
  if (mode === 'cdn') draft.cdn ??= studioCdnExample(page!.id, selected?.name);
  if (codeTabsMode !== mode) buildCodeTabs();
  codeTabs?.select(next);
  loadEditor(next);
  $('code-label').textContent = fileLabels[next];
  modeTabs.select(mode);
  $<HTMLInputElement>('preview-seed').disabled = mode === 'cdn';
  $('api-example-note').textContent =
    mode === 'cdn'
      ? '直接加载本站 CDN 的完整 HTML；可编辑、预览、复制或下载。简单组件使用 data-eui 自动初始化，复杂逻辑调用同名 JS API。'
      : (mode === 'react' ? draft.reactKind + '。' : 'HTML + TypeScript 原生初始化。') +
        draft.notes;
}
function run() {
  clearTimeout(runTimer);
  if (!draft) return;
  if (mode === 'cdn') {
    void preview.runDocument(draft.cdn ?? '');
    $('code-state').textContent = '已提交 CDN HTML · Ctrl / ⌘ + Enter 重跑';
    return;
  }
  void preview.run({
    mode,
    source: mode === 'react' ? draft.react : draft.ts,
    html: draft.html,
    css: draft.css,
    seed: $<HTMLInputElement>('preview-seed').value,
    dark: dark.checked,
  });
  $('code-state').textContent = '已提交运行 · Ctrl / ⌘ + Enter 重跑';
}
scope.listen($('code-tabs'), 'eui-change', (event) => {
  const value = (event as CustomEvent<{ value: typeof file }>).detail.value;
  if (!draft || !value) return;
  file = value;
  loadEditor(value);
  $('code-label').textContent = fileLabels[value];
});
scope.listen($('mode-tabs'), 'eui-change', (event) => {
  const value = (event as CustomEvent<{ value: 'html' | 'react' | 'cdn' }>).detail.value;
  if (!draft || !value) return;
  mode = value;
  showFile(modeFile());
  run();
});
scope.listen($('api-search'), 'input', () => renderNav());
scope.listen($('preview-seed'), 'change', run);
scope.listen(dark, 'change', () => {
  theme.setMode(dark.checked ? 'dark' : 'light');
  run();
});
scope.listen(
  $('copy-code'),
  'click',
  () =>
    void (async () => {
      try {
        await navigator.clipboard.writeText(editor.state.doc.toString());
        $('code-state').textContent = '已复制当前文件';
      } catch {
        $('code-state').textContent = '请在代码框中全选复制';
      }
    })(),
);
scope.listen($('reset-example'), 'click', () => {
  if (!page) return;
  draft = exampleFor(page.id, selected?.name);
  save();
  showFile(modeFile());
  run();
});
scope.listen($('download-example'), 'click', () => {
  if (!draft || !page) return;
  const url = URL.createObjectURL(
    new Blob(
      [
        mode === 'cdn'
          ? (draft.cdn ?? '')
          : JSON.stringify({ page: page.id, mode, ...draft }, null, 2),
      ],
      {
        type: mode === 'cdn' ? 'text/html' : 'application/json',
      },
    ),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = page.id.replace('/', '-') + (mode === 'cdn' ? '-cdn.html' : '-example.json');
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
});

/* ------------------------------------------------------------------ */
/* Reference tables                                                     */
/* ------------------------------------------------------------------ */
let tableButtons: { destroy(): void }[] = [];
function table(title: string, rows: Member[], parent: HTMLElement) {
  if (!rows.length) return;
  const heading = document.createElement('h3');
  heading.textContent = title;
  parent.append(heading);
  const filter = document.createElement('input');
  filter.type = 'search';
  filter.className = 'api-member-filter';
  filter.placeholder = '筛选名称、类型或说明';
  filter.setAttribute('aria-label', '筛选' + title);
  parent.append(filter);
  const wrap = document.createElement('div');
  wrap.className = 'api-table-wrap';
  const table = document.createElement('table');
  table.innerHTML =
    '<thead><tr><th scope="col">名称</th><th scope="col">类型</th><th scope="col">说明</th></tr></thead><tbody></tbody>';
  wrap.append(table);
  parent.append(wrap);
  const pager = document.createElement('div');
  pager.className = 'api-table-pages';
  parent.append(pager);
  let offset = 0,
    filtered = rows,
    pagerButtons: { destroy(): void }[] = tableButtons;
  filter.oninput = () => {
    const query = filter.value.trim().toLowerCase();
    filtered = rows.filter((row) =>
      (row.name + ' ' + row.type + ' ' + row.description).toLowerCase().includes(query),
    );
    offset = 0;
    paint();
  };
  function paint() {
    const body = table.tBodies[0]!;
    body.replaceChildren();
    for (const row of filtered.slice(offset, offset + 15)) {
      const tr = document.createElement('tr');
      const name = document.createElement('td'),
        type = document.createElement('td'),
        description = document.createElement('td'),
        code = document.createElement('code');
      name.textContent = row.name + (row.optional ? ' ?' : '');
      code.textContent = row.type;
      type.append(code);
      description.textContent = row.description || '—';
      tr.append(name, type, description);
      body.append(tr);
    }
    for (const button of pagerButtons) button.destroy();
    pagerButtons = [];
    pager.replaceChildren();
    const previous = document.createElement('button'),
      next = document.createElement('button'),
      label = document.createElement('span');
    previous.type = next.type = 'button';
    previous.textContent = '上一组';
    next.textContent = '下一组';
    previous.disabled = offset === 0;
    next.disabled = offset + 15 >= filtered.length;
    label.textContent = `${filtered.length ? offset + 1 : 0}–${Math.min(offset + 15, filtered.length)} / ${filtered.length}`;
    previous.onclick = () => {
      offset = Math.max(0, offset - 15);
      paint();
    };
    next.onclick = () => {
      offset = Math.min(offset + 15, Math.floor(Math.max(0, filtered.length - 1) / 15) * 15);
      paint();
    };
    // Pager buttons are real Expressive UI buttons (ripple + shape morph).
    for (const button of [previous, next])
      pagerButtons.push(enhanceButton(button, { variant: 'outlined', size: 'sm' }));
    pager.append(previous, label, next);
    pager.hidden = filtered.length <= 15;
  }
  paint();
}
function renderReference(symbol: ApiSymbol, changeExample = false) {
  memberScope.dispose();
  memberScope = new Scope();
  for (const button of tableButtons.splice(0)) button.destroy();
  selected = symbol;
  const parent = $('api-reference');
  parent.replaceChildren();
  const heading = document.createElement('h3');
  heading.textContent = symbol.name + ' · ' + symbol.kind;
  const description = document.createElement('p');
  description.textContent =
    symbol.description || '签名、参数与返回成员由当前 TypeScript 源码生成。';
  const signature = document.createElement('pre');
  signature.className = 'api-signature';
  signature.textContent = symbol.signatures.length
    ? symbol.signatures
        .map((signature) => (symbol.kind === 'class' ? 'new ' : '') + symbol.name + signature)
        .join('\n')
    : symbol.type;
  parent.append(heading, description, signature);
  table('属性 / 类型成员', symbol.members, parent);
  table(
    '参数',
    symbol.parameters.map((parameter) => ({
      ...parameter,
      description:
        parameter.description +
        (parameter.defaultValue !== null ? ' 默认：' + parameter.defaultValue : ''),
    })),
    parent,
  );
  for (const parameter of symbol.parameters)
    table(parameter.name + ' 的完整选项', parameter.members, parent);
  table('返回控制器 / 实例成员', symbol.returns, parent);
  table('组件事件 · detail 类型与可取消性', page?.events ?? [], parent);
  if (page?.package === 'adapter-react' && changeExample) {
    draft = exampleFor(page.id, symbol.name);
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey()) ?? 'null');
      if (saved && ['html', 'ts', 'react', 'css'].every((key) => typeof saved[key] === 'string'))
        draft = { ...draft, ...saved };
    } catch {}
    if (mode !== 'cdn') mode = 'react';
    showFile(modeFile());
    run();
  }
}
scope.listen($('api-symbol'), 'change', () => {
  save();
  const symbol = page?.symbols.find(
    (symbol) => symbol.name === $<HTMLSelectElement>('api-symbol').value,
  );
  if (symbol) {
    history.replaceState(null, '', '#/' + page!.id + '?symbol=' + encodeURIComponent(symbol.name));
    renderReference(symbol, true);
  }
});

/* ------------------------------------------------------------------ */
/* Section entrance animations (respects reduced motion)                */
/* ------------------------------------------------------------------ */
function replaySections() {
  for (const section of document.querySelectorAll<HTMLElement>('.api-section')) {
    section.classList.remove('api-in');
    requestAnimationFrame(() => requestAnimationFrame(() => section.classList.add('api-in')));
  }
}
async function navigate() {
  save();
  const [route, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  let id = 'components/button';
  try {
    id = decodeURIComponent(route ?? '') || id;
  } catch {}
  const wantedSymbol = new URLSearchParams(query).get('symbol');
  if (new URLSearchParams(query).get('mode') === 'cdn') mode = 'cdn';
  const entry = index.find((item) => item.id === id);
  if (!entry) {
    location.hash = '#/components/button';
    return;
  }
  const request = ++loadRequest;
  preview.clear();
  clearTimeout(runTimer);
  $('api-intro').textContent = '正在读取此页 API…';
  try {
    const loader = loaders['./generated/' + entry.file];
    if (!loader) throw Error('Missing API data');
    const module = (await loader()) as { default: ApiPage };
    if (request !== loadRequest) return;
    page = module.default;
    document.title = `${nice(page.module)} · Expressive UI API`;
    $('api-title').textContent =
      page.package === 'adapter-react' ? 'React adapters' : nice(page.module);
    $('api-crumb').textContent = titles[page.package] + ' / ' + page.module;
    $('api-intro').textContent =
      `${page.source} 的完整公开导出。选择具体符号查看签名、所有选项和返回控制器；示例可修改并运行。`;
    const summary = $('api-summary');
    summary.replaceChildren();
    for (const text of [
      page.package === 'styles' ? 'CSS Custom Properties' : `@amiracle1024/${page.package}`,
      `${page.symbols.length} 个参考项`,
      '原生 DOM · 可覆盖 CSS',
      '生成式 API',
    ]) {
      const badge = document.createElement('span');
      badge.textContent = text;
      summary.append(badge);
    }
    const symbols = $<HTMLSelectElement>('api-symbol');
    symbols.replaceChildren();
    for (const symbol of page.symbols) {
      const option = document.createElement('option');
      option.value = option.textContent = symbol.name;
      symbols.append(option);
    }
    selected =
      page.symbols.find((symbol) => symbol.name === wantedSymbol) ??
      page.symbols.find((symbol) => symbol.name.startsWith('enhance')) ??
      page.symbols.find((symbol) => symbol.kind === 'function') ??
      page.symbols[0];
    if (selected) symbols.value = selected.name;
    if (page.package === 'adapter-react' && mode !== 'cdn') mode = 'react';
    draft = exampleFor(page.id, selected?.name);
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey()) ?? 'null');
      if (saved && ['html', 'ts', 'react', 'css'].every((key) => typeof saved[key] === 'string'))
        draft = { ...draft, ...saved };
    } catch {
      /* Invalid or unavailable draft storage leaves the canonical example. */
    }
    const position = index.findIndex((item) => item.id === page!.id);
    for (const [element, next] of [
      [$<HTMLAnchorElement>('api-prev'), index[position - 1]],
      [$<HTMLAnchorElement>('api-next'), index[position + 1]],
    ] as const) {
      element.hidden = !next;
      if (next) element.href = '#/' + next.id;
    }
    $('api-declaration').textContent = page.declaration;
    renderNav();
    if (selected) renderReference(selected);
    showFile(modeFile());
    $('api-main').scrollIntoView({ block: 'start', behavior: 'instant' });
    $('api-main').focus({ preventScroll: true });
    replaySections();
    run();
  } catch (error) {
    $('api-intro').textContent = '无法加载 API：' + String(error);
  }
}
scope.listen(window, 'hashchange', () => void navigate());
scope.listen(window, 'pagehide', (event) => {
  save();
  if (!(event as PageTransitionEvent).persisted) scope.dispose();
});
renderNav();
void navigate();
if (import.meta.hot) import.meta.hot.dispose(() => scope.dispose());
