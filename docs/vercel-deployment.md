# Vercel 部署 Playground

根目录的 `vercel.json` 已配置本仓库的 Vite 多页构建：

| 设置             | 值                   |
| ---------------- | -------------------- |
| Root Directory   | 仓库根目录 `.`       |
| Framework Preset | Vite                 |
| Install Command  | `npm ci`             |
| Build Command    | `npm run build:code` |
| Output Directory | `dist/playground`    |

无需环境变量。构建直接使用 workspace 源码，不依赖这些包已发布到 npm。构建会生成 API 文档、沙盒运行时、字体和懒加载形变资源；GitHub Actions 另行运行测试和 npm tarball 检查。

## 从 GitHub 导入

在 Vercel 新建项目，导入 `littlefish1145/ExpressiveUI`，保留上述设置，生产分支选择 `main`。首次部署完成后，后续推送至 `main` 会触发生产部署，PR 可使用 Preview 部署。

## CLI 部署

在仓库根目录运行，按提示选择自己的账户和项目：

```sh
npx vercel login
npx vercel link
npx vercel --prod
```

CLI 上传会根据 `.vercelignore` 排除本地构建、npm tarball、调试文件和凭据。`.vercel/` 只保留在本机，不提交 Git。

## 页面与验收

- `/`：组件 Playground。
- `/api.html#/components/button`：API Studio；`/api` 也可访问。
- `/stress.html`：压力实验；`/stress` 也可访问。

页面采用真实多页入口，API Studio 子页使用 URL hash。静态资源不会被统一重写到 `index.html`。部署后检查三个页面、深浅色切换及 API Studio 的 HTML/React 在线运行。

带 hash 的 `/assets/` 文件使用长期缓存；沙盒运行时文件重新验证缓存，避免更新后继续使用旧版本。

配置依据：[Vercel 的 Vite 部署说明](https://vercel.com/docs/frameworks/frontend/vite)、[vercel.json 官方文档](https://vercel.com/docs/project-configuration/vercel-json)。
