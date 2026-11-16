# npm 发布

首个版本统一为 `0.1.0`，使用 npm 用户 `amiracle1024` 的个人 scope。根 workspace 为 private，不发布。

## 准备产物

在仓库根目录，使用 Node.js 22.12+ 与 npm：

```sh
npm ci
npm run release:prepare
```

该命令执行生产构建和单元测试，将七个包打包到 `dist/npm/`，然后在系统临时目录创建独立项目，仅安装 tarball 与外部依赖，检查：

- 包的发布元数据、许可证、文件清单与内部依赖版本。
- 所有 ESM 导出与 CSS 子入口、CSS 相对引用和字体文件。
- TypeScript 声明（strict，skipLibCheck 关闭，使用 React 18 类型）。
- 实际按需加载的形变数据。

`dist/npm/manifest.json` 记录各包版本、大小、完整性校验值和验证结果。`release:prepare` 和 `release:pack` 都不会上传 npm。已经构建后，只需重新打包验证可运行 `npm run release:pack`。

每个包的 `prepack` 会检查构建入口，直接在未构建的检出目录中打包会失败。请发布下面经过验证的 tarball，避免临时重新打包出不同内容。

## 登录与首次发布

在你自己的终端登录 npm，按提示在浏览器完成登录：

```sh
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
```

确认输出为 `amiracle1024`。不要把登录 token 或一次性验证码写入仓库。

登录成功不代表满足发布验证要求。如果发布返回 `E403` 并提示需要 two-factor authentication，请先在 npm 账户启用 2FA，再按 CLI 提示完成验证；此时不要反复重试相同发布请求。

按依赖顺序，在仓库根目录发布已经验证的产物；根据 npm 提示完成账户验证：

```sh
npm publish ./dist/npm/amiracle1024-core-0.1.0.tgz --access public
npm publish ./dist/npm/amiracle1024-tokens-0.1.0.tgz --access public
npm publish ./dist/npm/amiracle1024-shape-0.1.0.tgz --access public
npm publish ./dist/npm/amiracle1024-motion-0.1.0.tgz --access public
npm publish ./dist/npm/amiracle1024-theme-0.1.0.tgz --access public
npm publish ./dist/npm/amiracle1024-components-0.1.0.tgz --access public
npm publish ./dist/npm/amiracle1024-adapter-react-0.1.0.tgz --access public
```

每条命令成功后再执行下一条。如果中途失败，先查看 registry 上各包的版本，只继续尚未发布的包。同一包名的相同版本不能重复发布；修改已发布内容需要提升版本并重新验证。参见 [npm publish 官方说明](https://docs.npmjs.com/cli/v11/commands/npm-publish/)。

## 安装验收

发布后，在另一个空目录通过 registry 安装：

```sh
npm init -y
npm install @amiracle1024/components@0.1.0 @amiracle1024/theme@0.1.0
```

在支持 ESM 和 CSS 的前端项目中使用：

```ts
import '@amiracle1024/components/styles.css';
import { enhanceButton } from '@amiracle1024/components';
```

React 使用者另外安装 `@amiracle1024/adapter-react`、`react` 与 `react-dom`；React 是 peer dependency，不会被打包进适配器。
