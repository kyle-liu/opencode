/**
 * opencode serve 子命令：启动无界面的 HTTP API 服务
 */


/***
 * Server：启动和停止 HTTP API 的模块
 * cmd：yargs 子命令的包装函数
 *withNetworkOptions / resolveNetworkOptions：解析端口、host、mdns、cors 等
  Flag：检查环境变量（如 OPENCODE_SERVER_PASSWORD）
***/
import { Server } from "../../server/server"
import { cmd } from "./cmd"
import { withNetworkOptions, resolveNetworkOptions } from "../network"
import { Flag } from "../../flag/flag"

export const ServeCommand = cmd({
  command: "serve", //子命令名
  builder: (yargs) => withNetworkOptions(yargs), // 添加 --port、--hostname、--mdns、--cors 等选项
  describe: "starts a headless opencode server",
  handler: async (args) => {  // 实际逻辑
     //未设置 OPENCODE_SERVER_PASSWORD 时输出安全警告
    if (!Flag.OPENCODE_SERVER_PASSWORD) {
      console.log("Warning: OPENCODE_SERVER_PASSWORD is not set; server is unsecured.")
    }
    /***
     * 合并命令行 args 和全局配置（如 ~/.opencode/opencode.jsonc）
     * 得到 { hostname, port, mdns, mdnsDomain, cors }
     * 若命令行未指定，则用配置中的值
     */
    const opts = await resolveNetworkOptions(args) // 合并命令行参数与全局配置
    const server = Server.listen(opts)
    console.log(`opencode server listening on http://${server.hostname}:${server.port}`)
    await new Promise(() => {}) // 永不 resolve，阻塞以保持进程运行
    await server.stop()
  },
})
