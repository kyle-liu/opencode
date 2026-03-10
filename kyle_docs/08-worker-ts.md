# worker.ts 源码解读

Worker 在独立线程/进程中运行，负责：1）承载 HTTP Server；2）订阅 SDK 事件并转发给主进程；3）响应主进程的 RPC 调用。

---

## 一、整体职责

| 职责 | 说明 |
|------|------|
| 承载 Server | `Server.App().fetch()` 处理 HTTP 请求，可选择性 `Server.listen()` 暴露端口 |
| 事件转发 | `startEventStream` 订阅 opencode SDK 事件，通过 `Rpc.emit("event")` 转发给主进程 |
| RPC 服务端 | 实现 `rpc.fetch`、`rpc.server`、`rpc.reload`、`rpc.shutdown` 等，供主进程调用 |

---

## 二、初始化 (14-20)

```typescript
await Log.init({ print, dev, level })
```

- 日志初始化：本地开发时 DEBUG，否则 INFO

---

## 三、异常与全局事件 (22-36)

- `unhandledRejection` / `uncaughtException`：兜底捕获，记录日志
- `GlobalBus.on("event", ...)`：监听全局总线，`Rpc.emit("global.event", event)` 转发给主进程

---

## 四、事件流 `startEventStream` (45-94)

Worker 内部维护一个到 opencode SDK 的事件订阅：

1. 用 `Server.App().fetch` 作为 fetch 实现，并注入 `getAuthorizationHeader()`
2. `createOpencodeClient` 创建 SDK 客户端，`baseUrl: "http://opencode.internal"`
3. `while (!signal.aborted)` 死循环：
   - 调用 `sdk.event.subscribe` 获取 SSE 事件流
   - 遍历 `events.stream`，每收到一个事件就 `Rpc.emit("event", event)` 发给主进程
   - 断线或出错时 `await Bun.sleep(250)` 后重试

主进程通过 `createEventSource(client)` 订阅 `"event"`，即可拿到这些事件，无需自己发起 HTTP SSE。

---

## 五、启动时立即订阅 (96)

```typescript
startEventStream(process.cwd())
```

Worker 一加载完成就根据 `process.cwd()` 订阅事件流。

---

## 六、RPC 接口 `rpc` (98-144)

| 方法 | 作用 |
|------|------|
| **fetch** | 接收主进程传来的 { url, method, headers, body }，在 Worker 内调用 `Server.App().fetch`，返回 { status, headers, body }。主进程的 `createWorkerFetch` 会调用它 |
| **server** | 根据 `{ port, hostname, mdns, cors }` 启动 HTTP Server；若已有 server 先 `stop` 再 `listen` |
| **checkUpgrade** | 用 `Instance.provide` 在指定目录执行 upgrade 逻辑 |
| **reload** | 重置全局配置，`Instance.disposeAll()` 释放实例 |
| **shutdown** | 终止事件流、dispose 实例、停止 server，用于 Worker 退出前的清理 |

---

## 七、`getAuthorizationHeader` (147-152)

- 读取 `Flag.OPENCODE_SERVER_PASSWORD` 等
- 返回 `Basic base64(username:password)` 格式，供 fetch 与 SDK 客户端使用

---

## 八、主进程与 Worker 调用关系

```
主进程 (thread.ts)                     Worker (worker.ts)
      │                                      │
      │  new Worker() ────────────────────▶  │ 顶层：Log.init、GlobalBus、startEventStream
      │  Rpc.client(worker)                  │ Rpc.listen(rpc)
      │                                      │
      │  client.call("fetch", ...) ────────▶ │ rpc.fetch → Server.App().fetch
      │  client.call("server", ...) ───────▶ │ rpc.server → Server.listen
      │  client.on("event", handler) ◀──────  │ Rpc.emit("event", event)
      │  client.call("shutdown") ──────────▶ │ rpc.shutdown → 清理并退出
```

---

## 九、相关文件

| 作用 | 文件 |
|------|------|
| Worker 脚本 | `packages/opencode/src/cli/cmd/tui/worker.ts` |
| 主进程创建 Worker | `packages/opencode/src/cli/cmd/tui/thread.ts` |
| createWorkerFetch / createEventSource | `thread.ts` 第 20-49 行 |
