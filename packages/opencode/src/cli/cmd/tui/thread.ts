import { cmd } from "@/cli/cmd/cmd"
import { tui } from "./app"
import { Rpc } from "@/util/rpc"
import { type rpc } from "./worker"
import path from "path"
import { UI } from "@/cli/ui"
import { iife } from "@/util/iife"
import { Log } from "@/util/log"
import { withNetworkOptions, resolveNetworkOptions } from "@/cli/network"
import type { Event } from "@opencode-ai/sdk/v2"
import type { EventSource } from "./context/sdk"
import { win32DisableProcessedInput, win32InstallCtrlCGuard } from "./win32"

declare global {
  const OPENCODE_WORKER_PATH: string
}

type RpcClient = ReturnType<typeof Rpc.client<typeof rpc>>

/**
 * 默认 TUI 模式下，主进程不监听端口。TUI 需要向本地 API 发请求（如创建 session、发送 prompt）。
 * 因为 Server 在 Worker 里，所以主进程不能直接用 fetch("http://localhost:...")，
 * 而是用 RPC 把请求交给 Worker 去发
 * 当不启动 HTTP Server 时，将 fetch 请求通过 RPC 转发给 Worker 执行。
 * 主进程不监听端口，TUI 的 HTTP 请求由 Worker 内的 Server 处理。
 * 
 * 
 * 整体流程是：主进程 → RPC 序列化请求 → Worker 执行真实 HTTP 请求 → RPC 返回结果 → 主进程构造 Response。这样 TUI 只需调用“fetch”，就能访问 Worker 内部的 Server，而无需在本地监听端口。
 */
function createWorkerFetch(client: RpcClient): typeof fetch {
  const fn = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init)
    // body 为 ReadableStream，无法跨进程传递，需先读取为字符串
    const body = request.body ? await request.text() : undefined
    // 通过 RPC 调用 Worker 内的 fetch handler，在 Worker 中发起真实 HTTP 请求
    const result = await client.call("fetch", {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
    })
    return new Response(result.body, {
      status: result.status,
      headers: result.headers,
    })
  }
  return fn as typeof fetch
}

/** 当不启动 HTTP Server 时，通过 RPC 从 Worker 接收 SSE 事件 */
function createEventSource(client: RpcClient): EventSource {
  return {
    on: (handler) => client.on<Event>("event", handler),
  }
}

export const TuiThreadCommand = cmd({
  command: "$0 [project]",
  describe: "start opencode tui",
  builder: (yargs) =>
    withNetworkOptions(yargs)
      .positional("project", {
        type: "string",
        describe: "path to start opencode in",
      })
      .option("model", {
        type: "string",
        alias: ["m"],
        describe: "model to use in the format of provider/model",
      })
      .option("continue", {
        alias: ["c"],
        describe: "continue the last session",
        type: "boolean",
      })
      .option("session", {
        alias: ["s"],
        type: "string",
        describe: "session id to continue",
      })
      .option("fork", {
        type: "boolean",
        describe: "fork the session when continuing (use with --continue or --session)",
      })
      .option("prompt", {
        type: "string",
        describe: "prompt to use",
      })
      .option("agent", {
        type: "string",
        describe: "agent to use",
      }),
  handler: async (args) => {
    // Win32: 保持 ENABLE_PROCESSED_INPUT 关闭，防止 bun run 下 Ctrl+C 杀死进程组
    const unguard = win32InstallCtrlCGuard()
    try {
      // Win32: 必须在 Worker 启动前禁用 CTRL_C_EVENT
      win32DisableProcessedInput()

      // 参数校验：--fork 必须配合 --continue 或 --session
      if (args.fork && !args.continue && !args.session) {
        UI.error("--fork requires --continue or --session")
        process.exitCode = 1
        return
      }

      // 解析工作目录：args.project 为可选项目路径
      const baseCwd = process.env.PWD ?? process.cwd()
      const cwd = args.project ? path.resolve(baseCwd, args.project) : process.cwd()
      // 确定 Worker 脚本路径：优先构建产物，否则用源码
      const localWorker = new URL("./worker.ts", import.meta.url)
      const distWorker = new URL("./cli/cmd/tui/worker.js", import.meta.url)
      const workerPath = await iife(async () => {
        if (typeof OPENCODE_WORKER_PATH !== "undefined") return OPENCODE_WORKER_PATH
        if (await Bun.file(distWorker).exists()) return distWorker
        return localWorker
      })
      try {
        process.chdir(cwd)
      } catch (e) {
        UI.error("Failed to change directory to " + cwd)
        return
      }

      // 启动 Worker 子进程，Worker 内运行 Server 和事件转发
      /**
       * new Worker(workerPath, options) 一执行，就会立刻启动一个 Worker 子线程/进程，并开始执行 workerPath 指向的脚本。
       * 也就是说：构造函数调用 = 启动：new Worker() 返回时，Worker 已经创建并运行，正在执行 worker.ts 顶层代码。
       * 并行执行：主线程不会被阻塞，Worker 在另一个线程/进程中并行运行。
       * 随后才用 RPC：主线程紧接着会 Rpc.client(worker)，通过 postMessage 和 Worker 进行 RPC 通信。
       *  因此，const worker = new Worker(...) 这一行执行完成后，Worker 已经处于运行状态。
       */
      const worker = new Worker(workerPath, {
        env: Object.fromEntries(
          Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
        ),
      })
      worker.onerror = (e) => {
        Log.Default.error(e)
      }
      const client = Rpc.client<typeof rpc>(worker)
      process.on("uncaughtException", (e) => {
        Log.Default.error(e)
      })
      process.on("unhandledRejection", (e) => {
        Log.Default.error(e)
      })
      process.on("SIGUSR2", async () => {
        await client.call("reload", undefined)
      })

      // 获取初始 prompt：支持管道输入或 --prompt 参数
      const prompt = await iife(async () => {
        const piped = !process.stdin.isTTY ? await Bun.stdin.text() : undefined
        if (!args.prompt) return piped
        return piped ? piped + "\n" + args.prompt : args.prompt
      })

      // 判断是否启动 HTTP 服务器：显式指定 --port/--hostname/--mdns 或配置中启用时
      const networkOpts = await resolveNetworkOptions(args)
      const shouldStartServer =
        process.argv.includes("--port") ||
        process.argv.includes("--hostname") ||
        process.argv.includes("--mdns") ||
        networkOpts.mdns ||
        networkOpts.port !== 0 ||
        networkOpts.hostname !== "127.0.0.1"

      let url: string
      let customFetch: typeof fetch | undefined
      let events: EventSource | undefined

      if (shouldStartServer) {
        // 启动 HTTP Server，供外部访问（Web、远程客户端等）
        const server = await client.call("server", networkOpts)
        url = server.url
      } else {
        // 默认：不监听端口，通过 RPC 直接与 Worker 通信
        url = "http://opencode.internal"
        customFetch = createWorkerFetch(client)
        events = createEventSource(client)
      }

      // 启动 TUI，阻塞直到用户退出
      const tuiPromise = tui({
        url,
        fetch: customFetch,
        events,
        args: {
          continue: args.continue,
          sessionID: args.session,
          agent: args.agent,
          model: args.model,
          prompt,
          fork: args.fork,
        },
        onExit: async () => {
          await client.call("shutdown", undefined)
        },
      })

      // 异步检查升级，不阻塞 TUI 启动
      setTimeout(() => {
        client.call("checkUpgrade", { directory: cwd }).catch(() => {})
      }, 1000)

      await tuiPromise
    } finally {
      unguard?.()
    }
  },
})
