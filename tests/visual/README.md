# 视觉基线

未生成任何截图；没有启动浏览器自动化。需由维护者显式运行和审核。

`npm run test:visual:update` 会为每个 Playwright project 创建独立基线。先固定操作系统、字体和浏览器版本，检查每张 PNG，再提交。不要将一次未经审核的 update 视为测试通过。`npm run test:browser` 执行后会输出真实结果。

共享轮廓数值断言用于核查后端几何一致性，各浏览器截图用于平台内部回归。DPR 2、iPhone 视口、light/dark、五种后端、非方形尺寸均已定义测试用例。DOM emulation 测试不能替代浏览器渲染测试。
