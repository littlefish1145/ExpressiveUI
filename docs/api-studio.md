# API Studio

独立入口：`/api.html#/components/button`。原展示页侧栏新增API Studio链接，旧展示页与压力页保留。

当前为54个独立页面，覆盖七包248个公开导出，另有CSS变量/事件参考页。按组件与引擎分组，支持搜索、前后页、具体符号深链接、选项/成员表筛选及每15行分页。完整声明由TypeScript Compiler API生成，接口继承和返回控制器从实际类型解析；源码中的nullish回退表达式原样标注，不推测缺失默认值。公开CSS变量与eui事件从源码提取，原生click/input/change仍按平台语义使用。覆盖清单为[api-coverage.json](api-coverage.json)。

## 代码和预览

- HTML模式分别编辑语义HTML、TypeScript和CSS；TS导出`mount(root)`并返回清理函数。
- React模式编辑TSX和CSS，默认导出App。Button/Fab/Switch/LoadingIndicator/IconButton/Checkbox/Radio/Slider使用真实专用adapter；其他组件明确标为useEffect集成，并为每次effect分配独立子容器，避免异步初始化或StrictMode清理影响下一实例。
- 支持Ctrl/⌘+Enter、可选700ms自动运行、每页独立本地草稿、恢复、复制及JSON下载；React适配页按组件分别保存草稿。
- Web Worker通过Sucrase转译TS/TSX。在线转译不等于完整TypeScript语义检查；项目命令会严格编译所有规范示例。
- 预览采用只允许脚本的sandbox iframe，没有allow-same-origin。脚本/样式不能改文档DOM；可交互组件的DOM、Dialog、焦点和表单保留在iframe。重跑/换页卸载旧React根与控制器，再移除旧iframe上下文。编译错误、运行错误与最近100条Console显示在预览面板。
- 本地预编译经典脚本内置本库、React/React DOM，不依赖CDN或在线转译服务。字体以内嵌数据加载；1190组官方形变通过受限postMessage请求由文档父页按需提供，未把全部形变塞进运行时。
- 可导入七个本库包、`@expressive-ui/theme/runtime`、Shape的geometry/renderer/library子入口、React、react-dom/client与react/jsx-runtime。styles.css/fonts.css导入由已加载的预览CSS满足。当前不支持编辑器内任意npm包安装、相对多文件模块或外部网络资源。预览sandbox是DOM/能力隔离，不宣称能阻止用户自己写出的死循环占用CPU。

## 构建与更新

```sh
npm run prepare:playground  # 从当前源码生成API JSON和预览运行时
npm run check:api           # 严格编译122份HTML/TS、React示例，不执行浏览器
npm run build:code          # 无测试的源码与生产构建
npm run dev                # 启动前自动prepare
npm run preview            # 生产预览，默认4173
```

修改库API后重新运行prepare或build，保证生成声明与预览运行时同步。常规构建在缺少`docs/references/sources.json`时使用现有Token快照并明确输出未重校验；`npm run tokens`仍是要求官方资料缓存的显式刷新命令。未把缓存缺失伪装成官方来源验证通过。

本轮完成TypeScript strict、122份示例转译/类型编译、七包与Vite生产构建，以及HTTP资源可达性检查。遵守用户要求，没有运行浏览器自动化，也没有声称已实际验收所有浏览器中的在线编辑行为。
