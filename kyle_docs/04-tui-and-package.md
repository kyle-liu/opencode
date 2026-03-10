# TUI 原理与 package.json

## Q: 为什么 bun run 可以启动一个界面并支持输入？

**A:** 由 `@opentui/solid` 实现：

1. **`render()`**：将 SolidJS 组件渲染到终端（stdout），通过 ANSI 转义序列绘制界面
2. **`useKeyboard`**：监听键盘输入（stdin）
3. **stdin**：接收键盘输入
4. **stdout**：输出字符和 ANSI 序列到终端

本质是程序通过 stdin/stdout 与终端交互，opentui 将其封装成类似前端的组件模型。

---

## Q: package.json 一般可以有哪些作用？

**A:** 常见用途：

| 用途 | 字段 |
|------|------|
| 项目信息 | name, version, description, license |
| 依赖 | dependencies, devDependencies |
| 脚本 | scripts |
| 入口 | main, module, exports, bin |
| 引擎 | engines |
| Monorepo | workspaces |
| 工具配置 | prettier, eslintConfig 等 |
