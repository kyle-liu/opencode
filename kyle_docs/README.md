# OpenCode 源码解读 - Kyle 笔记

本目录整理了针对 opencode 源码的问答记录，便于查阅和复习。

## 文档索引

| 文件 | 内容 |
|------|------|
| [01-agent-and-entry.md](./01-agent-and-entry.md) | Agent 入口、Go 语言、CLI GUI |
| [02-build-and-run.md](./02-build-and-run.md) | 构建、安装、本地启动 |
| [03-cli-and-yargs.md](./03-cli-and-yargs.md) | TUI、serve、yargs、参数解析、命令关系 |
| [04-tui-and-package.md](./04-tui-and-package.md) | TUI 原理、package.json 作用 |
| [05-source-structure.md](./05-source-structure.md) | 源码目录结构与模块 |
| [06-index-ts-and-package-json.md](./06-index-ts-and-package-json.md) | index.ts 与 package.json 解读、常见问题修复 |
| [07-execution-flow.md](./07-execution-flow.md) | bun dev 执行流程、无子命令路由、TUI→Session 流程、关键文件 |
| [08-worker-ts.md](./08-worker-ts.md) | worker.ts 源码解读、事件流、RPC 接口、主进程调用关系 |
| [09-main-worker-rpc-and-events.md](./09-main-worker-rpc-and-events.md) | 主进程与 Worker 的 RPC、事件推送架构、业务场景与交互流程 |

## 快速参考

### 本地开发启动

```bash
bun install
bun dev              # TUI
bun dev serve        # API
bun dev:web          # Web（需先 serve）
```

### 关键入口

- CLI：`packages/opencode/src/index.ts`
- Agent：`packages/opencode/src/agent/agent.ts`
- TUI：`packages/opencode/src/cli/cmd/tui/`
- API：`packages/opencode/src/server/`
