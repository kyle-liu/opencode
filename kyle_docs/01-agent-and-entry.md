# Agent 入口与项目结构

## Q: 帮我找到 Agent 入口文件

**A:** opencode 中有多处与 Agent 相关的入口：

| 用途 | 入口文件 |
|------|----------|
| CLI 主入口 | `packages/opencode/src/index.ts` |
| Agent 命令 | `packages/opencode/src/cli/cmd/agent.ts` |
| ACP 协议 Agent | `packages/opencode/src/acp/agent.ts` |
| 核心 Agent 逻辑 | `packages/opencode/src/agent/agent.ts` |
| ACP 服务器命令 | `packages/opencode/src/cli/cmd/acp.ts` |

---

## Q: 这里面有 Go 代码吗？

**A:** 没有。opencode 项目中没有 `.go` 文件。文档中的 gopls、gofmt 只是说明对 Go 项目的支持，而非用 Go 开发。

技术栈主要为 TypeScript + Bun，桌面端为 Rust (Tauri)。

---

## Q: 为什么网上搜索 opencode 是 Go + TypeScript 开发的？

**A:** 常见误解来源：

1. **opencode-sdk-go**：官方 Go SDK，用于 Go 调用 OpenCode API，并非 opencode 本身用 Go 实现
2. **microsoft/typescript-go**：与 opencode 无关的微软项目
3. **"OpenCode 支持 Go"**：指的是可辅助 Go 项目，而非用 Go 写

---

## Q: 这段代码，哪个是构建 CLI GUI？

**A:** TUI（终端界面）由 `TuiThreadCommand` 负责，定义在 `packages/opencode/src/cli/cmd/tui/thread.ts`，使用 `command: "$0 [project]"` 作为默认命令。
