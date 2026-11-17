# @epui/shape

Polygon、Rounded 几何、SVG 渲染和按需加载的形变数据。

## 安装

首个版本 `0.1.0` 已发布到 npm。

```sh
npm install @epui/shape
```

## 使用

```ts
import { createMorph } from '@epui/shape';

const morph = createMorph('heart', 'circle');
await morph.ready;
const points = morph.at(0.5);
console.log(points);
```

只需数值几何时可导入 `@epui/shape/geometry`；其他公开子入口为 `/renderer`、`/library`。形变使用前须等待 `morph.ready`。

ESM，附带 TypeScript 类型声明。

[项目与使用说明](https://github.com/littlefish1145/ExpressiveUI#readme) · [反馈问题](https://github.com/littlefish1145/ExpressiveUI/issues)

独立社区实现，与 Google 无隶属关系。Apache-2.0；第三方声明见包内 NOTICE，字体另受 OFL 许可证约束。
