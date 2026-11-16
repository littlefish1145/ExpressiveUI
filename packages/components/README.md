# @amiracle1024/components

原生 HTML、CSS 和 TypeScript 的 Material 3 Expressive 组件，不需要框架运行时。

## 安装

首个版本计划为 `0.1.0`；以下命令在包发布后可用。

```sh
npm install @amiracle1024/components
```

## 使用

```ts
import '@amiracle1024/components/styles.css';
import { enhanceButton } from '@amiracle1024/components';

const button = document.createElement('button');
button.textContent = '保存';
document.body.append(button);
const controller = enhanceButton(button, { variant: 'filled' });
// 在所属组件卸载时调用 controller.destroy()。
```

组件 CSS 包含 Roboto 字体引用；只需字体时可导入 `@amiracle1024/components/fonts.css`。浏览器界面需要 DOM；React 集成可另装 `@amiracle1024/adapter-react`。

ESM，附带 TypeScript 类型声明。浏览器交互需要现代浏览器环境。

[项目与使用说明](https://github.com/littlefish1145/ExpressiveUI#readme) · [反馈问题](https://github.com/littlefish1145/ExpressiveUI/issues)

独立社区实现，与 Google 无隶属关系。Apache-2.0；第三方声明见包内 NOTICE，字体另受 OFL 许可证约束。
