# 构建与运行

## Q: 当前工程应该如何构建？

**A:** 环境要求：Bun 1.3+

```bash
# 安装依赖
bun install

# 开发模式
bun dev                    # TUI
bun dev serve              # API 服务
bun dev:web                # Web 界面（需先 bun dev serve）
bun dev:desktop            # 桌面应用

# 构建生产版
./packages/opencode/script/build.ts --single   # 单平台 CLI
bun run --cwd packages/desktop tauri build     # 桌面应用
```

---

## Q: bun install 提示 zsh: command not found: bun

**A:** 需先安装 Bun：

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.zshrc
bun --version
```

---

## Q: 如何在本地启动这个程序？

**A:** 源码模式下使用 `bun dev` 替代 `opencode`：

```bash
cd /path/to/opencode
bun install
bun dev              # 启动 TUI
bun dev serve        # 启动 API
bun dev:web          # 启动 Web（需先 serve）
```

---

## Q: 输入 opencode serve --port 8080 提示命令不存在

**A:** 未安装 opencode 时，用 `bun dev` 代替：

```bash
bun dev serve --port 8080
```

---

## Q: 安装好 opencode 后，是否支持直接运行 opencode 命令？

**A:** 支持。安装后会在 PATH 中加入 opencode 可执行文件，可直接使用：

```bash
opencode serve --port 8080
opencode --help
```
