import { readFile, writeFile, stat } from 'node:fs/promises';
const before = JSON.parse(await readFile('docs/performance-before.json', 'utf8'));
const bootBefore = JSON.parse(await readFile('docs/playground-size-before.json', 'utf8'));
const after = JSON.parse(await readFile('docs/bundle-size.json', 'utf8'));
const boot = JSON.parse(await readFile('docs/playground-size.json', 'utf8'));
const oldJS = bootBefore.assets.filter((row) => row.file.endsWith('.js'));
const oldBytes = oldJS.reduce((sum, row) => sum + row.bytes, 0),
  oldGzip = oldJS.reduce((sum, row) => sum + row.gzip, 0);
const latin = (await stat('packages/components/src/fonts/Roboto-latin.woff2')).size;
const kb = (value) => (value / 1000).toFixed(1) + ' KB';
const change = (a, b) => ((1 - b / a) * 100).toFixed(1) + '%';
const comparisons = [
  ['Playground静态入口JS（含共享chunks）', oldBytes, boot.initialJSBytes],
  ['同上gzip level 6', oldGzip, boot.initialJSGzipLevel6],
  ['常用Latin字体请求', before.fontBytes, latin],
  ...['shape', 'components'].map((name) => [
    name + '静态bundle gzip level 9',
    before.rows.find((row) => row.package === name).gzipBytes,
    after.rows.find((row) => row.package === name).gzipBytes,
  ]),
];
await writeFile(
  'docs/performance.md',
  `# 性能与体积优化 · 2026-11-15

## 可重复的产物测量

| 项目 | 修改前 | 修改后 | 减少 |
|---|---:|---:|---:|
${comparisons.map(([name, a, b]) => `| ${name} | ${kb(a)} | ${kb(b)} | ${change(a, b)} |`).join('\n')}

初始JS根据Vite manifest递归计算静态依赖，包含拆出的共享文件，不能只比较index文件。动态导入不计入这项；目录接近视口、进入Shape Lab或修改配色会继续加载相应资源。HTML现在包括完整目录，${kb(boot.htmlBytes)}（gzip level 9 ${kb(boot.htmlGzip)}）；CSS初始共${kb(boot.rows.filter((row) => row.file.endsWith('.css')).reduce((sum, row) => sum + row.bytes, 0))}，没有将HTML/CSS/字体成本隐藏进JS降幅。首屏实际网络与CPU收益仍需浏览器复测。

## 实现

- 1190组官方形变保留精度；1183组按需数据的加载索引也改为动态导入。七组Loading匹配保持同步；Shape Lab进入视口才准备其配对数据。单独的geometry/renderer导出不携带形状数据。
- 默认light/dark和八套配色预览在构建期用同一MCU算法生成。动态HCT模块在修改颜色或新contrast预览时加载；输入合并，过时计算结果不再写回。
- 组件目录及扩展内容随HTML输出，不再启动后向Shape Lab前方插入整块页面。目录逻辑接近视口时加载，分批增强；首屏组件增强也分批让出主线程。CSS仍首屏提供，避免延后样式闪动。
- Loading/Progress复用一个IntersectionObserver和一个visibility监听，屏幕外暂停循环且保留时间，回到附近恢复。不支持IntersectionObserver时保持原功能。显式pause/play、Reduced Motion与销毁继续有效。
- 忽略本库颜色动画自身的祖先style输出，避免每帧触发后代重新读取计算样式；ResizeObserver过滤相同尺寸的重复通知，手动refresh仍可强制刷新。
- Roboto按真实cmap拆分Latin和extended，保留轮廓及variable axes；Latin预加载。完整原始字体仍在源码，可重新运行python scripts/subset-font.py生成；构建本身不要求安装Python。中文继续使用系统字体。
- 本地PerformanceObserver提供LCP、CLS会话窗口、长任务和最近布局偏移来源；不上传数据。observedBlockingMs是整个观察窗口的长任务阻塞和，不等于Lighthouse TBT。

## 手工复测

运行npm run build:code后运行npm run preview，打开http://127.0.0.1:4173/。使用相同设备、节流、缓存策略和URL hash连续测三次，记录中位数；开发5173与生产4173应分开记录。[Vite生产构建说明](https://vite.dev/guide/build.html)。

控制台输入window.expressive.performance查看本地诊断；window.expressive.pause()可辅助比较循环动效的消耗，不作为默认关闭动画的优化。

用户截图基线来自5173/#components：Performance 30，FCP 2.5s，LCP 20.3s，TBT 770ms，CLS 0.4，Speed Index 5.3s。此次没有运行浏览器自动化、Lighthouse或测试，因此没有修改后分数、帧率和真实CLS验收结论。动态注入与字体是CLS的已知风险，不能仅凭截图确认每项占比。[Chrome关于CLS原因与预留布局的说明](https://web.dev/articles/optimize-cls)。

## 尚未达标及下一步

完整Shape入口仍超过8KB预算，主要包含官方形状和七组同步匹配；几何与渲染子入口另列于bundle-size.md。单Button约10KB gzip，仍有优化空间。完整官方配对产物总量约8.7MB，按需加载仍占发布包空间。下一轮根据生产Lighthouse的LCP元素、布局偏移来源及长任务记录，确定是否进一步拆分Shape Lab与初始化；目前不以减少组件状态、删除官方曲线或关掉首屏动效换取分数。

## 命令

npm run build:code · npm run size · npm run size:playground · node scripts/performance-report.mjs

上述均不运行测试。体积定义分别见bundle-size.md与playground-size.json；修改前快照保留在performance-before.json和playground-size-before.json。
`,
);
console.log('Updated docs/performance.md');
