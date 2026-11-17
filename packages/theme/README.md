# @epui/theme

使用 Material Color Utilities 生成 HCT 主题，并提供轻量主题运行时。

## 安装

首个版本 `0.1.0` 已发布到 npm。

```sh
npm install @epui/theme
```

## 使用

```ts
import { generateTheme, createThemeController } from '@epui/theme';

const themes = {
  light: generateTheme({ seed: '#6750a4' }),
  dark: generateTheme({ seed: '#6750a4', dark: true }),
};
const controller = createThemeController(document.documentElement, themes, 'system');
// 在所属组件卸载时调用 controller.destroy()。
```

只应用预生成主题时可使用 `@epui/theme/runtime`，避免引入 HCT 计算依赖。

ESM，附带 TypeScript 类型声明。浏览器交互需要现代浏览器环境。

[项目与使用说明](https://github.com/littlefish1145/ExpressiveUI#readme) · [反馈问题](https://github.com/littlefish1145/ExpressiveUI/issues)

独立社区实现，与 Google 无隶属关系。Apache-2.0；第三方声明见包内 NOTICE，字体另受 OFL 许可证约束。
