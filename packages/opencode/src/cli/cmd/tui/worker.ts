import { Installation } from "@/installation"
import { Server } from "@/server/server"
import { Log } from "@/util/log"
import { Instance } from "@/project/instance"
import { InstanceBootstrap } from "@/project/bootstrap"
import { Rpc } from "@/util/rpc"
import { upgrade } from "@/cli/upgrade"
import { Config } from "@/config/config"
import { GlobalBus } from "@/bus/global"
import { createOpencodeClient, type Event } from "@opencode-ai/sdk/v2"
import type { BunWebSocketData } from "hono/bun"
import { Flag } from "@/flag/flag"

// Worker 内日志初始化：本地开发 DEBUG，否则 INFO
await Log.init({
  print: process.argv.includes("--print-logs"),
  dev: Installation.isLocal(),
  level: (() => {
    if (Installation.isLocal()) return "DEBUG"
    return "INFO"
  })(),
})

process.on("unhandledRejection", (e) => {
  Log.Default.error("rejection", {
    e: e instanceof Error ? e.message : e,
  })
})

process.on("uncaughtException", (e) => {
  Log.Default.error("exception", {
    e: e instanceof Error ? e.message : e,
  })
})

// 监听全局总线事件，通过 RPC 转发给主进程
/**
 * Rpc	RPC 工具，Worker 和主进程通过它通信
 * emit	发送事件（单向，不等待返回值）
 * "global.event"	事件名，主进程用这个名字监听
 *  event	事件 payload，会被序列化后发送到主进程
 * 
 Worker (worker.ts)                          主进程 (thread.ts 或其他)
      │                                              │
GlobalBus 触发 "event"                               │
      │                                              │
Rpc.emit("global.event", event) ──────────────────▶  client.on("global.event", handler)
      │                                              │
      │                                              handler(event) 被调用
 */
GlobalBus.on("event", (event) => {
  Rpc.emit("global.event", event)
})

let server: Bun.Server<BunWebSocketData> | undefined

const eventStream = {
  abort: undefined as AbortController | undefined, // 用于 shutdown 时终止事件流
}

/** 订阅 opencode SDK 事件流，通过 Rpc.emit("event") 转发给主进程 TUI */
const startEventStream = (directory: string) => {
  if (eventStream.abort) eventStream.abort.abort()
  const abort = new AbortController()
  eventStream.abort = abort
  const signal = abort.signal

  // SDK 的 fetch 实现：走 Worker 内 Server.App()，并注入认证头
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const auth = getAuthorizationHeader()
    if (auth) request.headers.set("Authorization", auth)
    return Server.App().fetch(request)
  }) as typeof globalThis.fetch

  const sdk = createOpencodeClient({
    baseUrl: "http://opencode.internal",
    directory,
    fetch: fetchFn,
    signal,
  })

  // 死循环订阅事件：断线后 250ms 重试
  ;(async () => {
    while (!signal.aborted) {
      const events = await Promise.resolve(
        sdk.event.subscribe(
          {},
          {
            signal,
          },
        ),
      ).catch(() => undefined)

      if (!events) {
        await Bun.sleep(250) // 订阅失败时短暂休眠后重试
        continue
      }

      for await (const event of events.stream) {
        Rpc.emit("event", event as Event) // 转发给主进程 TUI
      }

      if (!signal.aborted) {
        await Bun.sleep(250)
      }
    }
  })().catch((error) => {
    // 异步 IIFE 错误兜底
    Log.Default.error("event stream error", {
      error: error instanceof Error ? error.message : error,
    })
  })
}

startEventStream(process.cwd()) // Worker 加载完成后立即订阅事件流

/** RPC 接口：主进程 thread.ts 通过 client.call() 调用 */
export const rpc = {
  /** 主进程 createWorkerFetch 转发来的 fetch 请求，在 Worker 内执行 */
  async fetch(input: { url: string; method: string; headers: Record<string, string>; body?: string }) {
    const headers = { ...input.headers }
    const auth = getAuthorizationHeader()
    if (auth && !headers["authorization"] && !headers["Authorization"]) {
      headers["Authorization"] = auth // 注入 Basic 认证
    }
    const request = new Request(input.url, {
      method: input.method,
      headers,
      body: input.body,
    })
    const response = await Server.App().fetch(request)
    const body = await response.text()
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body,
    }
  },
  /** 启动 HTTP Server 暴露端口，供 Web/远程客户端访问 */
  async server(input: { port: number; hostname: string; mdns?: boolean; cors?: string[] }) {
    if (server) await server.stop(true)
    server = Server.listen(input)
    return { url: server.url.toString() }
  },
  /** 在指定目录执行 upgrade 检查 */
  async checkUpgrade(input: { directory: string }) {
    await Instance.provide({
      directory: input.directory,
      init: InstanceBootstrap,
      fn: async () => {
        await upgrade().catch(() => {})
      },
    })
  },
  /** SIGUSR2 触发：重置配置并释放实例 */
  async reload() {
    Config.global.reset()
    await Instance.disposeAll()
  },
  /** TUI 退出时调用：终止事件流、释放实例、停止 Server */
  async shutdown() {
    Log.Default.info("worker shutting down")
    if (eventStream.abort) eventStream.abort.abort()
    await Instance.disposeAll()
    if (server) server.stop(true)
  },
}

Rpc.listen(rpc) // 注册 RPC 服务端，响应主进程的 client.call

/** 读取环境变量，返回 Basic 认证头，供 fetch 与 SDK 使用 */
function getAuthorizationHeader(): string | undefined {
  const password = Flag.OPENCODE_SERVER_PASSWORD
  if (!password) return undefined
  const username = Flag.OPENCODE_SERVER_USERNAME ?? "opencode"
  return `Basic ${btoa(`${username}:${password}`)}`
}
