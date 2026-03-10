# 源码目录结构与模块

## 整体架构

opencode 为 Monorepo，使用 Bun workspaces 和 Turborepo。

## 核心包

### packages/opencode（核心引擎）

```
packages/opencode/src/
├── index.ts          # CLI 入口
├── acp/              # ACP 协议（Zed 等）
├── agent/            # Agent 定义
├── cli/cmd/          # 子命令（agent, serve, run, tui...）
├── server/           # HTTP API（Hono）
├── session/          # 会话逻辑
├── tool/             # Agent 工具（bash, read, write...）
├── provider/         # LLM 提供商
├── project/          # 项目管理
└── ...
```

### 其他包

| 包 | 作用 |
|----|------|
| packages/app | 共享 Web UI（SolidJS） |
| packages/desktop | 桌面应用（Tauri） |
| packages/sdk/js | JavaScript SDK |
| packages/plugin | 插件系统 |
| packages/web | 官网与文档 |
| packages/console | Console 产品 |

## 学习顺序建议

1. `packages/opencode/src/index.ts` - CLI 入口
2. `packages/opencode/src/session/` - 会话
3. `packages/opencode/src/tool/` - 工具
4. `packages/opencode/src/agent/agent.ts` - Agent
5. `packages/opencode/src/server/` - API
6. `packages/app/` - 前端
