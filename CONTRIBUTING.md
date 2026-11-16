# Contributing

欢迎提交可复现的问题、规范来源纠正和实现改进。请先阅读 docs/architecture.md 与 docs/spec-mapping.md。

1. Node22.12+，`npm ci`，`npm run build`。
2. 保持依赖方向，无 Core/Shape/Motion 第三方运行依赖。新增库应说明包体积与 tree shaking 影响。
3. 每个官方数值必须带固定版本来源；不确定的值标为 provisional。区分 Baseline/Expressive。
4. 使用原生语义和显式生命周期。新增交互应验证键盘、disabled、取消、中断和资源清理。
5. `npm run typecheck`、`npm test`、`npm run build` 必须通过。`npm run format:check` 检查手写源码格式。
6. 视觉基线需固定字体、系统、浏览器版本并逐图人工审核；不要提交未运行的测试结果。

通常不需要重新下载官方源码。常规构建使用仓库中已固定的参考快照，不访问网络。研究脚本会重新读取 upstream，应审查 commit 变化后再更新 mapping。可选 `node scripts/export-shapes.mjs` 要求 Java17+ 与网络访问 Maven，只在修改官方几何数据时使用。

贡献者保留自己的版权，提交内容按 Apache-2.0 许可。保留第三方版权声明，避免把 Google Material 商标用于暗示官方背书。
