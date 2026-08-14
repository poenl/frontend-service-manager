# frontend-service-manager

[![npm version](https://img.shields.io/npm/v/frontend-service-manager)](https://www.npmjs.com/package/frontend-service-manager)
[![npm downloads](https://img.shields.io/npm/dm/frontend-service-manager)](https://www.npmjs.com/package/frontend-service-manager)
[![license](https://img.shields.io/npm/l/frontend-service-manager)](LICENSE)

本机前端开发服务管理器：以图形界面集中管理多个前端项目的 vite dev server，并提供自包含的生产 daemon 托管命令 `fsm`。

## 功能特性

- **多项目集中管理**：服务列表与详情页，一键启动/停止，实时运行状态
- **实时日志与状态**：SSE 事件流推送，日志由 `anser` 彩色渲染；页面在后台时通过浏览器通知提示状态变化
- **生产力细节**：服务拖拽排序、自动暂停、黑暗模式自动切换
- **项目目录管理**：设置页管理可用的项目目录（后端端口与前端端口可配置，运行中的服务锁定相关配置编辑）
- **生产自托管**：`pnpm build` 产出自包含的 standalone 产物，`fsm` CLI 在后台托管运行，全局安装后即装即用、免构建

## 安装

```bash
npm i -g frontend-service-manager
pnpm add -g frontend-service-manager
yarn global add frontend-service-manager
```

发布包包含 standalone 产物（含 `node_modules` 与静态资源），安装后无需任何构建即可运行。

## 快速开始

```bash
fsm start                 # 默认 3000 端口后台启动
fsm start --port 3001     # 指定端口启动
fsm status                # 查看运行状态（端口/ PID）
fsm log                   # 实时日志（Ctrl+C 退出不影响服务）
fsm stop                  # 停止服务
```

启动后浏览器访问 `http://localhost:3000`（或指定端口）。

## CLI 参考（fsm）

| 命令                 | 说明                                                                     |
| -------------------- | ------------------------------------------------------------------------ |
| `fsm stage`          | 将 `.next/static/` 与 `public/` 复制进 standalone 产物（构建链自动调用） |
| `fsm start [--port]` | 后台启动生产服务，默认端口 3000；端口被占用时会提示并拒绝启动            |
| `fsm stop`           | 停止后台服务（并连带终止界面中启动的前端服务）                           |
| `fsm status`         | 查看运行状态（端口与 PID）                                               |
| `fsm log`            | 实时跟随日志，退出不影响服务                                             |
| `fsm --version`      | 显示版本号                                                               |
| `fsm --help`         | 显示命令用法                                                             |

PID、端口与日志位于用户主目录下的 `~/.fsm/`（独立于包目录，全局安装/升级不丢状态）。`fsm start` 免构建：若产物缺失会提示先执行 `pnpm build`。

## 从源码开发

```bash
pnpm install            # 安装依赖
pnpm link               # 一次性全局链接，使 fsm 命令可用
pnpm dev                # 开发服务器
pnpm check              # typecheck + lint
pnpm build              # 生产构建（standalone 产物）
```

`pnpm build` 生成 `.next/standalone/`；发布/打包链（`prepack`）会随后调用 `scripts/manage.mjs stage` 复制静态资源与 `public/` 进产物。

## 发布到 npm

```bash
npm publish
```

`prepack` 会自动执行 `pnpm build` 并 stage 静态资源，发布内容为 `.next/standalone`（构建产物）与 `scripts`（fsm CLI），不含源码。产物独立性可这样自检：`npm pack` 后全局安装，在任意非项目目录运行 `fsm start / status / stop` 跑通即证明自包含。

## License

MIT
