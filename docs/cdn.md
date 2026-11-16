# CDN

入口：[CDN](https://expressive-ui-green.vercel.app/cdn)。在任意 HTML 引入两份文件即可：

```html
<link rel="stylesheet" href="https://expressive-ui-green.vercel.app/cdn/expressive-ui.css" />
<script defer src="https://expressive-ui-green.vercel.app/cdn/expressive-ui.js"></script>

<button data-eui="button">保存</button>
<button data-eui="button" data-variant="tonal" data-size="md">取消</button>
<label
  ><span><input data-eui="switch" type="checkbox" checked /></span> 通知</label
>
```

普通 script 暴露 `window.ExpressiveUI`，DOM 就绪时自动扫描 `data-eui`，动态插入的元素同样生效。移除元素后自动释放动画、事件和观察器；在同一批 DOM 更新中移动元素不会重复挂载。输入控件需要独立包装，文字放在包装之外。

`data-eui` 使用 `enhance` 函数去掉前缀后的连字符名称，例如 `text-field`、`navigation-bar`、`segmented-buttons`。`range-slider` 写在包含两个 range input 的包装上。常用字符串选项可使用 `data-variant`、`data-size`、`data-label`、`data-supporting-text`、`data-orientation`、`data-edge`；其他选项使用 `data-eui-options` JSON，名称、值与 npm API 一致。JSON 不能包含回调函数；涉及回调、复杂数据源时使用 JS API。

```html
<div data-eui="progress" data-label="上传进度" data-eui-options='{"value":0.6,"wavy":true}'></div>

<button data-eui="button" data-eui-open="details">详情</button>
<dialog data-eui="dialog" id="details" aria-labelledby="title">
  <h2 id="title">详情</h2>
  <button data-eui-close>关闭</button>
</dialog>

<button data-eui="button" id="help">帮助</button>
<div data-eui="tooltip" data-anchor="#help">悬停或聚焦查看提示。</div>
```

`data-anchor` 是指向现有元素的 CSS 选择器，适用于 menu、tooltip 等锚定组件。每个组件保留原生事件和对应的 `eui-*` 事件。初始化成功发出冒泡的 `eui-ready`，失败发出 `eui-error`，`detail` 分别包含 `controller` 或 `error`。

需要手动初始化时，元素不添加 `data-eui`：

```html
<button id="save">保存</button>
<!-- 不加 defer，后面的代码在 CDN 加载后执行 -->
<script src="https://expressive-ui-green.vercel.app/cdn/expressive-ui.js"></script>
<script>
  const button = ExpressiveUI.enhanceButton(document.querySelector('#save'), {
    variant: 'filled',
    size: 'md',
  });
  addEventListener('pagehide', () => button.destroy(), { once: true });
</script>
```

全部原生组件及 core、theme 的具名导出直接位于 `ExpressiveUI`。也可访问 `ExpressiveUI.components`、`.core`、`.tokens`、`.shape`、`.motion`、`.theme` 命名空间。`getController(element)` 获取声明式控制器，`init(root)` 幂等扫描子树，`destroy(root)` 销毁子树控制器；`stopAutoInit()` 停止自动扫描并销毁，`startAutoInit()` 恢复。

API Studio 每页提供「CDN HTML」：完整 HTML 可编辑、运行、复制、下载，并单独保存为该页草稿。简单组件为声明式示例，复杂逻辑使用相同 JS API。CDN 预览在隔离 iframe 中真正加载本站 JS、CSS、字体及延迟形状模块。

## ES Modules 和 React

`/cdn/expressive-ui.module.js` 提供相同原生 API 和自动初始化。各包独立入口 `/cdn/core.js`、`tokens.js`、`shape.js`、`motion.js`、`theme.js`、`components.js`、`adapter-react.js` 保留 npm 的全部公开 JS 导出；子入口如 `/cdn/theme/runtime.js`、`/cdn/shape/geometry.js` 同样可用。包入口不会自动扫描 DOM。

```html
<link rel="stylesheet" href="https://expressive-ui-green.vercel.app/cdn/expressive-ui.css" />
<button id="save">保存</button>
<script type="module">
  import { enhanceButton } from 'https://expressive-ui-green.vercel.app/cdn/components.js';
  const button = enhanceButton(document.querySelector('#save'));
</script>
```

`/cdn/import-map.json` 列出全部 npm 包名和 React 模块到本站文件的映射。复制其中的 `imports` 到页面的内联 `<script type="importmap">`，将相对 `/cdn/...` 地址改为站点绝对 URL 后，可保留原 npm 导入语句。React 入口包括 `react.js`、`react-dom-client.js`、`react-jsx-runtime.js`，与 adapter-react 共享同一份 React。JSX/TSX 仍需编译为 JS；普通 script 全局版本不捆绑 React。

## 构建和托管

`npm run build:cdn` 从当前仓库源码生成 `playground/public/cdn`，`prepare:playground`、开发和生产构建均会执行。Vite 将这些静态文件复制到 `dist/playground/cdn`，Vercel 用 `/cdn` 展示文档、`/cdn/*` 提供静态资源，添加公开跨域和重新验证缓存头。

字体随 CSS 引用；官方形状匹配数据按需加载到独立模块，不内联进普通 script。共享 ESM chunks 使用内容散列，classic 和 ESM 使用相同的形状 chunk。所有资源自托管于同一个 Vercel 站点，无第三方 CDN 运行时依赖。

无版本 URL 随本站源码部署更新，不等同于已发布 npm 版本的永久快照。需要冻结资源时下载整个 `dist/playground/cdn` 目录，保留字体和 chunks 的相对路径。`LICENSE`、`NOTICE` 和构建器生成的版权说明一并保留。
