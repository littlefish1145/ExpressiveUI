# @amiracle1024/core

资源作用域、事件监听、状态与浏览器能力工具。

## 安装

首个版本 `0.1.0` 已发布到 npm。

```sh
npm install @amiracle1024/core
```

## 使用

```ts
import { Scope } from '@amiracle1024/core';

const scope = new Scope();
scope.listen(document, 'click', () => console.log('clicked'));
// 在页面或组件卸载时释放资源。
scope.dispose();
```

ESM，附带 TypeScript 类型声明。浏览器交互需要现代浏览器环境。

[项目与使用说明](https://github.com/littlefish1145/ExpressiveUI#readme) · [反馈问题](https://github.com/littlefish1145/ExpressiveUI/issues)

独立社区实现，与 Google 无隶属关系。Apache-2.0；第三方声明见包内 NOTICE，字体另受 OFL 许可证约束。
