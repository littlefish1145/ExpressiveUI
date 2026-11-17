# expressive-ui

原生 HTML、CSS、TypeScript 实现的独立 Material 3 Expressive Web 组件库。Apache-2.0，ESM，七个 workspace 包，没有框架运行时要求。
官方确认的数值、派生值与暂定实现分别记录于 [规范映射](docs/spec-mapping.md)

## 运行

[CDN 直接引用](https://expressive-ui-green.vercel.app/cdn)：两行 CSS / JS 引用，添加 `data-eui="button"` 等属性即可使用，无需安装或初始化代码。API Studio 同步提供可编辑、下载的「CDN HTML」示例。更多选项、JS API、ESM 和 React 引用见 [CDN 文档](docs/cdn.md)。

新增独立分页的[API Studio](http://127.0.0.1:4173/api.html#/components/button)：完整API、HTML/TS与React代码、在线编辑预览。使用说明和生成/构建命令见[API Studio文档](docs/api-studio.md)。

Node.js 22.12+（本次使用24），npm11。首次运行：

```sh
npm ci
npm run dev
```

打开终端打印的本地地址（默认 [http://127.0.0.1:5173](http://127.0.0.1:5173)）。Playground 的基础演示和完整组件目录全部使用本库。

```sh
npm run typecheck    # TypeScript strict
npm test            # Vitest + happy-dom；不启动浏览器
npm run build       # Token / theme 生成、类型检查、测试、七包构建、Playground、体积报告
npm run preview     # 查看生产构建
npm run size        # ESM、bundle、gzip 与 Tree Shaking
npm run check:tokens
npm audit
```

## 已实现

新增Data Table（排序、选择、分页、过滤）、Banner、Flexible／Center-aligned app bar与完整Assist Chip演示，详见[扩展API](docs/extensions-api.md)与[版本／来源映射](docs/extensions-spec-mapping.md)。Data Table、Banner明确作为M3主题扩展，不宣称为官方Expressive新增组件。`npm run build:code`可完成当前阶段不运行测试的源码构建。

首轮性能优化、前后体积和手工Lighthouse复测方法见[性能记录](docs/performance.md)。`npm run size:playground`按Vite manifest统计静态入口及共享依赖；生产预览使用`npm run preview`（默认4173），与开发5173分别记录。控制台`window.expressive.performance`提供本地LCP、CLS和长任务诊断。

针对Accessibility 88的修复、100次反向数值检查和手动跨浏览器压力入口见[稳定性与可访问性记录](docs/stability-accessibility.md)。生产预览`/stress.html`提供实际引擎的手动实验；`npm run check:stability`运行本次定向数值检查，结果与真实浏览器验收分开记录。

新增目录的业务API与当前移植边界见[完整组件目录](docs/catalog-api.md)和[目录规范映射](docs/catalog-spec-mapping.md)。本轮依据截图修正浮层位移、输入焦点、滑块气泡、日期范围与共享动画，详见[UI修复记录](docs/ui-fixes.md)。按用户要求，当前先完成业务代码，暂不新增或运行测试；下面历史测试结果不代表本轮已验收。

- **Core**：资源作用域、显式销毁、状态 store、共享媒体偏好订阅、按需交互监听、能力检测、ResizeObserver。
- **Tokens**：从固定版本 AndroidX 源码生成12组弹簧、5个按钮尺寸、5个Icon Button尺寸/3种宽度、Switch/Checkbox/Radio/Slider尺寸。
- **Shape**：35个官方Polygon及其全部1190组有向feature-aware Morph数据，按配对加载；15个Rounded Token（含非对称/RTL）；真实cubic插值、跨family采样桥接、有界缓存；SVG / CSS polygon / CSS shape() / SVG clipPath / SVG mask五种后端。
- **Motion**：质量归一解析弹簧、三种阻尼状态、速度连续的中断和反向、动态目标、共享按需rAF、同模型WAAPI采样、Oklab颜色弹簧、后台暂停、system/full/reduced策略。
- **Theme**：官方 MCU HCT、9个 Variant、8组可切换配色预设、明暗色与 contrastLevel、48个颜色角色；独立轻量 runtime 可使用预生成主题。
- **Components**：Button 五种 variant / 五种尺寸 / 两种形状；FAB small/regular/medium/large/extended；原生 checkbox Switch；七形态 Expressive Loading Indicator；Icon Button 四种variant与选中形变；三态Checkbox；原生互斥Radio；连续/离散水平Slider。
- **React**：八类组件的可选薄适配，React 为 peer dependency，不进入 Core。已通过DOM环境StrictMode与受控Slider键盘更新测试。
- **共享效果**：官方Ripple阶段、hover/focus状态层、双层elevation、Outlined内侧描边；随库附带OFL1.1 Roboto可变字体。
- **Playground**：主题种子、八套配色、明暗模式、配色Variant、对比度、Motion Scheme、运动偏好与系统Reduced Motion提示、五种渲染后端、形变进度、宽高比、弹簧曲线、实时参数、暂停与重播、Capability面板。

## npm 包

七个包已发布为 `@epui/*@0.1.0`，可运行 `npm install @epui/components @epui/theme` 安装。运行 `npm run release:prepare` 完成构建、测试、打包与独立安装验证；产物在 `dist/npm/`。发布顺序与登录步骤见 [npm 发布说明](docs/npm-publishing.md)。

## 部署到 Vercel

在线体验：[Playground](https://expressive-ui-green.vercel.app/) · [API Studio](https://expressive-ui-green.vercel.app/api.html#/components/button) · [压力实验](https://expressive-ui-green.vercel.app/stress.html)。

在 Vercel 导入此 GitHub 仓库，Root Directory 使用仓库根目录。`vercel.json` 已配置 Vite 构建和 `dist/playground` 输出，无需环境变量。页面包含 `/`、`/api.html`、`/stress.html`；完整步骤见 [Vercel 部署说明](docs/vercel-deployment.md)。

## 使用

七个包已发布到 npm，本地 workspace 也已关联这些包。安装 npm 包或运行 `npm run build` 后可导入：

```html
<button id="save" type="submit">保存</button>
<label
  >接收通知 <span><input id="notify" type="checkbox" name="notify" /></span
></label>
<div id="loading"></div>
```

```ts
import '@epui/components/styles.css';
import { enhanceButton, enhanceSwitch, enhanceLoadingIndicator } from '@epui/components';

const button = enhanceButton(document.querySelector<HTMLButtonElement>('#save')!, {
  variant: 'filled',
  size: 'md',
  shape: 'round',
  motionScheme: 'expressive',
});
const toggle = enhanceSwitch(document.querySelector<HTMLInputElement>('#notify')!);
const loading = enhanceLoadingIndicator(document.querySelector<HTMLElement>('#loading')!, {
  label: '正在保存',
  contained: true,
});

// 页面卸载或组件拆除时显式释放监听、观察器、动画与装饰节点。
button.destroy();
toggle.destroy();
loading.destroy();
```

语义元素由应用创建；npm 包保留显式初始化，CDN 全局入口可自动扫描 `data-eui`。图标按钮需要 `aria-label`，装饰图标应 `aria-hidden="true"`。Switch wrapper 只包裹 input；文字 label 放在 wrapper 外，防止扩大的透明 hit area 遮住其他内容。

## 结构

```text
packages/{core,tokens,shape,motion,theme,components,adapter-react}/
playground/                Vite + TypeScript 演示站
tests/unit/                已执行的数值、DOM、生命周期测试
tests/{visual,interaction,performance}/  可选 Playwright 用例
docs/                      架构、映射、兼容性、测试与体积报告
docs/references/            官方固定版本源码与 SHA-256
scripts/                   构建、生成器、报告、可选官方几何导出
```

```sh
npx playwright install chromium firefox webkit
npm run test:browser
npm run test:visual:update  # 每张基线需人工审核后提交
npm run test:performance
```

这些测试并不能代替真实 iOS 设备、屏幕阅读器和不同字体环境的验证。

Polygon间Morph直接使用官方AndroidX匹配数据；Rounded与Polygon跨family使用本库采样桥接。当前八类组件的实现差异、平台约定和待人工验证项详见[一致性状态](docs/parity-status.md)、[兼容性](docs/compatibility.md)与[路线图](docs/roadmap.md)。若演示站静态显示，先看运动状态提示；可显式选择“完整动画”预览，默认仍尊重系统减少动态效果设置。

## 文档

[API 与 CSS 变量](docs/api.md) · [架构决策](docs/architecture.md) · [规范映射](docs/spec-mapping.md) · [贡献指南](CONTRIBUTING.md) · [许可证](LICENSE) · [第三方声明](NOTICE)
