# OpenCode 执行流程

本文档总结 `bun run --conditions=browser ./src/index.ts` 及 TUI 用户输入到 Session 管理的完整执行流程。

---

## 一、整体执行流程（bun dev 启动）

```
bun run --conditions=browser ./src/index.ts
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Bun 进程启动                                                              │
│    process.argv = [bun, ./src/index.ts]                                      │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. index.ts 加载                                                             │
│    - 导入 yargs、子命令、Log、UI 等                                            │
│    - 注册 unhandledRejection、uncaughtException                               │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. yargs 构建 CLI                                                            │
│    hideBin(process.argv) → []                                                │
│    middleware：Log.init、AGENT=1、OPENCODE=1                                  │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. cli.parse()                                                               │
│    无子命令 → 匹配 TuiThreadCommand (command: "$0 [project]")                  │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. TuiThreadCommand.handler (thread.ts)                                      │
│    - win32 相关、参数校验                                                     │
│    - 解析 cwd、Worker 路径                                                    │
│    - process.chdir(cwd)                                                      │
│    - new Worker(workerPath)  ← Worker 启动                                    │
│    - Rpc.client(worker)                                                      │
│    - 默认不启动 HTTP server，使用 createWorkerFetch + createEventSource       │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 6. tui({ url, fetch, events, args })  (app.tsx)                              │
│    - 创建 SDK、订阅事件                                                       │
│    - render() 渲染 TUI (opentui)                                              │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 7. Worker 进程 (worker.ts)                                                   │
│    - Server.App().fetch() 处理请求                                            │
│    - startEventStream() → Rpc.emit("event") 转发事件                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、无子命令 → TuiThreadCommand 的逻辑

| 位置 | 文件 | 作用 |
|------|------|------|
| 定义 | `packages/opencode/src/cli/cmd/tui/thread.ts` 第 45 行 | `command: "$0 [project]"` |
| 注册 | `packages/opencode/src/index.ts` 第 90 行 | `.command(TuiThreadCommand)` |
| 路由 | yargs 库 | 无子命令时，`$0` 作为默认命令 |

`$0` 是 yargs 约定：表示脚本名本身，作为顶层/默认命令。

---

## 三、Worker 启动时机

- **位置**：`thread.ts` 第 110 行
- **代码**：`const worker = new Worker(workerPath, {...})`
- **触发**：执行 `opencode` 或 `bun dev` 且进入 TuiThreadCommand.handler 后

---

## 四、TUI 用户输入 → Session 管理流程

```
用户输入
    │
    ▼
prompt/index.tsx submit()
    ├─ 无 sessionID → sdk.client.session.create()
    └─ sdk.client.session.prompt() / .command() / .shell()
    │
    ▼
createWorkerFetch → RPC 到 Worker
    │
    ▼
server/routes/session.ts
    ├─ Session.create()
    └─ SessionPrompt.prompt() / .command() / .shell()
    │
    ▼
session/prompt.ts
    ├─ Session.get()
    ├─ Session.updateMessage() / Session.updatePart()
    └─ loop() → SessionProcessor
    │
    ▼
session/processor.ts
    ├─ Session.updatePart() (流式)
    ├─ Session.updateMessage()
    └─ Session.getUsage()
    │
    ▼
session/index.ts
    ├─ Storage 写入
    └─ Bus.publish() → 事件 → TUI 刷新
```

---

## 五、关键文件清单

| 作用 | 文件路径 |
|------|----------|
| CLI 入口 | `packages/opencode/src/index.ts` |
| TUI 启动、Worker 创建 | `packages/opencode/src/cli/cmd/tui/thread.ts` |
| Worker | `packages/opencode/src/cli/cmd/tui/worker.ts` |
| TUI 主界面 | `packages/opencode/src/cli/cmd/tui/app.tsx` |
| 输入框、submit | `packages/opencode/src/cli/cmd/tui/component/prompt/index.tsx` |
| Session API 路由 | `packages/opencode/src/server/routes/session.ts` |
| Session 模块 | `packages/opencode/src/session/index.ts` |
| SessionPrompt | `packages/opencode/src/session/prompt.ts` |
| SessionProcessor | `packages/opencode/src/session/processor.ts` |
