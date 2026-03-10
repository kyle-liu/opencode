# 主进程与 Worker 的 RPC 与事件推送架构

本文档总结 opencode TUI 模式下主进程与 Worker 之间的 RPC 调用、事件推送机制，以及主要业务场景与交互流程。

---

## 一、整体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          主进程 (thread.ts)                                   │
│  - TUI 渲染 (opentui)                                                        │
│  - 用户输入、UI 更新                                                          │
│  - Rpc.client(worker) 创建 RPC 客户端                                         │
└─────────────────────────────────────────────────────────────────────────────┘
        │                                    │
        │  client.call("xxx", params)        │  client.on("event", handler)
        │  主进程 → Worker (请求-响应)         │  Worker → 主进程 (推送)
        ▼                                    ▲
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Worker (worker.ts)                                  │
│  - Server.App() 处理 HTTP / SSE                                              │
│  - startEventStream 订阅 SDK 事件                                             │
│  - Rpc.listen(rpc) 注册 RPC 服务端                                            │
│  - Rpc.emit("event", payload) 推送事件                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、两种运行模式

| 模式 | 触发条件 | 主进程 ↔ Worker 通信方式 |
|------|----------|--------------------------|
| **RPC 模式（默认）** | 未指定 `--port` / `--hostname` / `--mdns` | 全部通过 RPC：`createWorkerFetch` + `createEventSource` |
| **HTTP 模式** | 显式指定 `--port` 或 `--hostname` 等 | 主进程走本地 HTTP，外部客户端也可访问 |

RPC 模式下主进程不监听端口，TUI 的 fetch 和事件流都通过 RPC 与 Worker 通信。

---

## 三、RPC 调用：主进程 → Worker

| RPC 方法 | 调用时机 | 作用 |
|----------|----------|------|
| **fetch** | TUI 发 HTTP 请求时（session.create、prompt 等） | 将请求转发给 Worker 内 `Server.App().fetch`，返回响应 |
| **server** | 需要暴露端口时（`shouldStartServer`） | 在 Worker 内启动 HTTP Server，返回 url |
| **checkUpgrade** | TUI 启动约 1 秒后 | 异步检查升级，不阻塞 TUI |
| **reload** | 收到 SIGUSR2 时 | 重置配置、释放 Instance |
| **shutdown** | TUI 退出（onExit） | 终止事件流、释放实例、停止 Server |

---

## 四、事件推送：Worker → 主进程

| 事件名 | 来源 | 用途 |
|--------|------|------|
| **event** | Worker 内 `sdk.event.subscribe()` 接收的 SSE 事件 | Session 更新、消息流式输出、Toast 等 → TUI 刷新 |
| **global.event** | Worker 内 `GlobalBus.on("event")` | 全局总线事件（跨 Instance）转发给主进程 |

主进程通过 `createEventSource(client)` 订阅 `"event"`，TUI 的 `SDKProvider` 用 `props.events.on(handleEvent)` 接收，再批量触发 UI 更新。

---

## 五、事件链路（SDK event 的完整路径）

```
Session / Processor / Tool / Server 等
        │
        ▼
  Bus.publish(def, properties)
        │
        ▼
Server GET /event 的 Bus.subscribeAll
        │
        ▼
  stream.writeSSE(event)  →  SSE 流
        │
        ▼
Worker: sdk.event.subscribe() 发起 HTTP GET /event，消费 SSE
        │
        ▼
Worker: for await (event of events.stream) → Rpc.emit("event", event)
        │
        ▼
主进程: client.on("event", handler) → createEventSource → handleEvent
        │
        ▼
TUI: emitter.emit → 各 Store 更新 → 界面刷新
```

---

## 六、主要业务场景与交互流程

### 6.1 用户输入 Prompt → Session 创建 / 发送

```
用户输入
    │
    ▼
TUI prompt/index.tsx submit()
    │
    ▼
sdk.client.session.create() / session.prompt()   ← 内部用 fetch
    │
    ▼
createWorkerFetch(client) 包装的 fetch
    │
    ▼
client.call("fetch", { url, method, headers, body })
    │
    ▼
Worker rpc.fetch → Server.App().fetch
    │
    ▼
server/routes/session.ts → Session.create() / SessionPrompt.prompt()
    │
    ▼
session/prompt.ts → SessionProcessor → AI 流式输出
```

### 6.2 流式输出与 TUI 实时刷新

```
SessionProcessor 更新消息
    │
    ▼
Bus.publish(MessageV2.Event.PartUpdated, ...)
    │
    ▼
Server /event 的 Bus.subscribeAll → stream.writeSSE
    │
    ▼
Worker sdk.event.subscribe 收到 → Rpc.emit("event", event)
    │
    ▼
主进程 client.on("event") → handleEvent → emitter.emit
    │
    ▼
TUI Store 更新 → 界面展示流式内容
```

### 6.3 启动与退出

```
启动:
  new Worker() → Worker 加载 worker.ts
  Rpc.client(worker) → 主进程获得 client
  createWorkerFetch(client) / createEventSource(client) → 传入 tui()
  tui({ url, fetch, events }) → 渲染 TUI

退出:
  onExit() → client.call("shutdown")
  Worker rpc.shutdown → 终止事件流、dispose 实例、停止 Server
```

### 6.4 热重载（SIGUSR2）

```
主进程: process.on("SIGUSR2") → client.call("reload")
Worker: rpc.reload → Config.global.reset() + Instance.disposeAll()
```

---

## 七、关键文件

| 职责 | 文件 |
|------|------|
| 主进程：创建 Worker、RPC client、createWorkerFetch、createEventSource | `cli/cmd/tui/thread.ts` |
| Worker：RPC 服务端、事件流订阅、Rpc.emit | `cli/cmd/tui/worker.ts` |
| TUI：SDK 初始化、props.events 订阅 | `cli/cmd/tui/context/sdk.tsx` |
| Server：/event SSE、Bus.subscribeAll | `server/server.ts` |
| Session API | `server/routes/session.ts` |
| Bus 发布 / 订阅 | `bus/index.ts` |

---

## 八、小结

- **RPC**：主进程通过 `client.call()` 向 Worker 发起请求，实现 fetch 转发、server 启动、reload、shutdown 等。
- **事件推送**：Worker 通过 `Rpc.emit("event", payload)` 主动推送，主进程通过 `client.on("event", handler)` 订阅，实现 Session 更新、消息流、Toast 等实时 UI 刷新。
- **事件源头**：业务逻辑 `Bus.publish()` → Server `/event` SSE → Worker `sdk.event.subscribe` → `Rpc.emit("event")` → 主进程 TUI 更新。
