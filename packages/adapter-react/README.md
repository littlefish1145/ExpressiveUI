# @amiracle1024/adapter-react

可选的 React 18+ 适配器，包含 Button、FAB、Switch、LoadingIndicator、IconButton、Checkbox、Radio、Slider。

## 安装

首个版本 `0.1.0` 已发布到 npm。

```sh
npm install @amiracle1024/adapter-react @amiracle1024/components react react-dom
```

## 使用

```tsx
import '@amiracle1024/components/styles.css';
import { Button } from '@amiracle1024/adapter-react';

export default function App() {
  return <Button options={{ variant: 'filled' }}>保存</Button>;
}
```

ESM，附带 TypeScript 类型声明。浏览器交互需要现代浏览器环境。

[项目与使用说明](https://github.com/littlefish1145/ExpressiveUI#readme) · [反馈问题](https://github.com/littlefish1145/ExpressiveUI/issues)

独立社区实现，与 Google 无隶属关系。Apache-2.0；第三方声明见包内 NOTICE，字体另受 OFL 许可证约束。
