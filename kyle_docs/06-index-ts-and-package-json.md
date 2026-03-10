# index.ts 与 package.json 解读

## index.ts 解读

`packages/opencode/src/index.ts` 为 CLI 入口，结构如下：

1. **导入**：yargs、各子命令、Log、UI、Installation 等
2. **全局错误处理**：`unhandledRejection`、`uncaughtException`
3. **CLI 构建**：基础配置、middleware、子命令注册、fail 处理
4. **执行**：`cli.parse()`，catch 中格式化错误并输出，finally 中 `process.exit()`

### 关键逻辑

- **middleware**：初始化 Log，设置 `AGENT=1`、`OPENCODE=1`
- **子命令**：AcpCommand、TuiThreadCommand（默认 $0）、ServeCommand、RunCommand 等
- **TuiThreadCommand** 的 `command: "$0 [project]"` 表示无子命令时启动 TUI

### 参数解析流程（以 opencode serve --port 8080 为例）

```
终端输入 → process.argv → hideBin → ["serve","--port","8080"]
→ yargs 解析 → ServeCommand.handler(args) → args.port = 8080
```

---

## 根 package.json 解读

- **scripts**：`dev` 启动 TUI，`dev:serve` 启动 API，`dev:web` 启动 Web
- **workspaces**：packages/*、console/*、sdk/js、slack
- **catalog**：集中管理依赖版本
- **dependencies**：@opencode-ai/plugin、sdk、script 等 workspace 包

---

## 常见问题修复

### moduleResolution 错误

**现象**：找不到 `@opencode-ai/util/error`，提示更新 moduleResolution。

**处理**：在 `packages/opencode/tsconfig.json` 的 compilerOptions 中显式设置：

```json
"moduleResolution": "bundler"
```

**原因**：`@opencode-ai/util` 通过 package.json 的 `exports` 暴露子路径，只有 `bundler`（或 node16、nodenext）会按 exports 正确解析。
