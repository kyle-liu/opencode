# CLI、yargs 与参数解析

## Q: 什么是 TUI？

**A:** TUI = Text User Interface（文本用户界面），在终端中用文字和符号进行交互的界面。

- **CLI**：纯命令行，一次一行
- **TUI**：终端内交互界面（如 opencode TUI、vim、htop）
- **GUI**：图形界面

---

## Q: opencode serve 是起什么作用？

**A:** 启动无界面（headless）API 服务，供 Web、桌面等客户端调用。默认端口 4096。

---

## Q: yargs 是干什么用的？

**A:** yargs 是 Node.js 的 CLI 参数解析库，用于：

1. 解析 `process.argv` 中的命令行参数
2. 定义子命令和选项
3. 生成 `--help` 帮助信息
4. 根据子命令调用对应 handler

---

## Q: opencode 命令的参数从哪里接受输入？

**A:** 流程如下：

1. 用户在终端输入 `opencode serve --port 8080` 并回车
2. 系统启动 opencode 进程，参数传入 `process.argv`
3. `hideBin(process.argv)` 得到 `["serve", "--port", "8080"]`
4. yargs 解析后路由到 `ServeCommand`，`args.port === 8080`

---

## Q: index.ts 第 41-42 行 `yargs(hideBin(process.argv))` 是让终端支持 opencode 命令吗？

**A:** 不是。让 `opencode` 成为终端命令由**安装**完成。这段代码负责在程序已启动后，解析用户输入的子命令和参数。

---

## Q: TUI 什么时候运行？

**A:** 在**未指定子命令**时作为默认命令运行：

```bash
opencode              # 启动 TUI
opencode .            # 启动 TUI（当前目录）
opencode serve        # 不启动 TUI，启动 API
```

---

## Q: bun dev 是如何代替 opencode 的？

**A:** 不完全是“代替”，而是执行同一套代码：

- `bun dev` 对应脚本：`bun run --cwd packages/opencode src/index.ts`
- 与安装版 opencode 共享同一个 `index.ts` 入口
- 区别在于启动方式：开发用 `bun run`，安装版用打包后的可执行文件
