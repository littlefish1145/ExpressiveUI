# npm 发布

七个包统一使用 `@epui` 组织 scope，首个组织版本为 `0.1.0`。根 workspace 为 private，不发布。发布账号 `amiracle1024` 是该组织的 owner；其他发布者需有对应的组织和包写权限。

## 从个人 scope 迁移

原 `@amiracle1024/*` 改为 `@epui/*`，对应 `core`、`tokens`、`shape`、`motion`、`theme`、`components`、`adapter-react` 七个包，组织首版均为 `0.1.0`。API、公开子入口、样式和字体用法保持一致。

```sh
npm uninstall @amiracle1024/components @amiracle1024/theme
npm install @epui/components @epui/theme
```

将项目内导入的 `@amiracle1024/` 替换为 `@epui/`，重新安装以更新 lockfile。React 项目还需迁移 adapter-react；显式安装的其余引擎包也按同样规则迁移。只替换实际使用的包即可。

旧包保留以兼容现有项目，在新包发布并验证后标注 deprecated 并提示对应的新包名，不删除旧版本。npm 不会自动将旧包切换成新 scope。CDN 文件地址保持不变，import map、API 参考和示例同步使用新 scope；API Studio 读取旧草稿时自动更新旧导入语句，并保留用户编辑。

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

确认输出为有组织发布权限的账号（当前为 `amiracle1024`），可用 `npm org ls epui --json` 检查成员角色。不要把登录 token 或一次性验证码写入仓库。

登录成功不代表满足发布验证要求。如果发布返回 `E403` 并提示需要 two-factor authentication，请先在 npm 账户启用 2FA，再按 CLI 提示完成验证；此时不要反复重试相同发布请求。

按依赖顺序，在仓库根目录发布已经验证的产物；根据 npm 提示完成账户验证：

```sh
npm publish ./dist/npm/epui-core-0.1.0.tgz --access public
npm publish ./dist/npm/epui-tokens-0.1.0.tgz --access public
npm publish ./dist/npm/epui-shape-0.1.0.tgz --access public
npm publish ./dist/npm/epui-motion-0.1.0.tgz --access public
npm publish ./dist/npm/epui-theme-0.1.0.tgz --access public
npm publish ./dist/npm/epui-components-0.1.0.tgz --access public
npm publish ./dist/npm/epui-adapter-react-0.1.0.tgz --access public
```

每条命令成功后再执行下一条。如果中途失败，先查看 registry 上各包的版本，只继续尚未发布的包。同一包名的相同版本不能重复发布；修改已发布内容需要提升版本并重新验证。参见 [npm publish 官方说明](https://docs.npmjs.com/cli/v11/commands/npm-publish/)。

## 安装验收

发布后，在另一个空目录通过 registry 安装：

```sh
npm init -y
npm install @epui/components@0.1.0 @epui/theme@0.1.0
```

在支持 ESM 和 CSS 的前端项目中使用：

```ts
import '@epui/components/styles.css';
import { enhanceButton } from '@epui/components';
```

React 使用者另外安装 `@epui/adapter-react`、`react` 与 `react-dom`；React 是 peer dependency，不会被打包进适配器。
