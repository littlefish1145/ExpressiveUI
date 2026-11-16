# @amiracle1024/motion

支持中断、速度连续和减少动态效果偏好的弹簧与颜色动画。

## 安装

首个版本 `0.1.0` 已发布到 npm。

```sh
npm install @amiracle1024/motion
```

## 使用

```ts
import { createSpring } from '@amiracle1024/motion';

const spring = createSpring(0, (value) => console.log(value));
spring.setTarget(1);
// 在所属组件卸载时调用。
// spring.destroy();
```

ESM，附带 TypeScript 类型声明。浏览器交互需要现代浏览器环境。

[项目与使用说明](https://github.com/littlefish1145/ExpressiveUI#readme) · [反馈问题](https://github.com/littlefish1145/ExpressiveUI/issues)

独立社区实现，与 Google 无隶属关系。Apache-2.0；第三方声明见包内 NOTICE，字体另受 OFL 许可证约束。
