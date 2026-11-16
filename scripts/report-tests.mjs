import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
const result = JSON.parse(await readFile('docs/test-results.json', 'utf8'));
const date = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  dateStyle: 'medium',
  timeStyle: 'medium',
}).format(new Date(result.startTime));
const files = result.testResults.map((test) => ({
  file: basename(test.name),
  passed: test.assertionResults.filter((a) => a.status === 'passed').length,
  failed: test.assertionResults.filter((a) => a.status === 'failed').length,
}));
const md = `# 本地测试结果\n\n执行时间：${date}（Asia/Shanghai）。Vitest + happy-dom，未使用浏览器自动化。\n\n**${result.numPassedTests}/${result.numTotalTests} 通过，${result.numFailedTests} 失败，${files.length}个文件。**\n\n| 文件 | 通过 | 失败 |\n|---|---:|---:|\n${files.map((t) => `| ${t.file} | ${t.passed} | ${t.failed} |`).join('\n')}\n\n原始数据：[test-results.json](test-results.json)。\n\n已执行数值与DOM检查包括：35个官方轮廓及1225组形变配对（含35组自配对）、官方Morph数据与异步加载、非对称RTL圆角与cubic后端、解析弹簧与重定向、八类组件、Icon Button选中/按压几何、Checkbox mixed/required/form/reset、Radio互斥与不同form、Slider步长/RTL/Page/Home/End/事件时序、八组配色主要文本对比度、真实Playground入口与React StrictMode受控表单。\n\n动画检查使用可控rAF验证Button、Icon Button、Checkbox、Radio、Switch、Slider气泡与Extended FAB的中间帧；另检查Ripple快速点击阶段、Oklab颜色与速度、Loading完成时间及保持阶段、Switch拖动取消、运动偏好切换和销毁后调度释放。颜色动画使用可计算的CSS测试夹具；happy-dom不能解析完整CSS layer，未将其当作真实绘制验收。\n\n浏览器视觉、原生pointer轨迹、原生Radio方向键、禁用fieldset默认激活、Safari/iOS、屏幕阅读器和实际heap/FPS未运行。happy-dom不能替代这些验收。Playwright仅提供可选用例，不在npm test/build中启动。\n\n包体积见[bundle-size.md](bundle-size.md)，一致性边界见[parity-status.md](parity-status.md)。按用户要求暂不以压缩体积为组件交付门槛。类型、构建、Token与依赖审计需通过各自命令检查；本报告仅自动记录Vitest结果。\n`;
await writeFile('docs/test-results.md', md);
if (result.numFailedTests || !result.success) throw Error('Tests failed; report preserved');
console.log(`Recorded ${result.numPassedTests} passing tests in ${files.length} files.`);
