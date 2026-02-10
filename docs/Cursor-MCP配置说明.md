# Cursor MCP 配置说明

参考市面上多数程序员在 Cursor 中的用法，直接给出可用的 MCP 配置与添加方式。

---

## 一、配置文件位置

| 作用范围 | 路径（Windows） | 路径（Mac/Linux） |
|----------|------------------|-------------------|
| **仅当前项目** | 项目根目录 `.cursor/mcp.json` | 同上 |
| **全局（所有项目）** | `C:\Users\你的用户名\.cursor\mcp.json` | `~/.cursor/mcp.json` |

- 项目级与全局可同时存在；同一名称的 server 以项目级为准。
- 新建或修改 `mcp.json` 后，在 Cursor 中 **重启 MCP** 或 **重新加载窗口**（Ctrl+Shift+P → “Developer: Reload Window”）后生效。

---

## 二、本项目已配置的 MCP（`.cursor/mcp.json`）

当前项目下已有一份可直接使用的配置，包含：

| 名称 | 作用 |
|------|------|
| **fetch** | 网页抓取（抓取 URL 转 Markdown/文本），使用 npm 包 `mcp-fetch-server` |
| **filesystem** | 在指定目录内读/写文件，当前已开放 **D 盘根目录** 与 **C 盘桌面** |
| **sequential-thinking** | 顺序推理，适合复杂问题拆解 |

**关于 fetch**：官方 `@modelcontextprotocol/server-fetch` 在 npm 上不存在（会 404），已改为使用 `mcp-fetch-server`。若仍报错，可改用 Python 方案：安装 [uv](https://github.com/astral-sh/uv) 后，将 fetch 的 command 改为 `uvx`，args 改为 `["mcp-server-fetch"]`。

若需修改 filesystem 的开放范围，直接编辑 `.cursor/mcp.json` 里 `filesystem.args` 的路径即可（多个目录就多写几个字符串）。

---

## 三、直接可用的完整配置（复制即用）

当前使用的配置（D 盘 + C 盘桌面 + 顺序思考）：

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "D:\\",
        "C:\\Users\\Administrator\\Desktop"
      ]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    }
  }
}
```

- **Windows**：若用户名不是 `Administrator`，把 `C:\\Users\\Administrator\\Desktop` 改成 `C:\\Users\\你的用户名\\Desktop`；要加其他盘或目录，在 `args` 里继续加路径字符串即可。
- **可选：Git 操作**（读仓库、搜索提交等），在 `mcpServers` 里增加：
  ```json
  "git": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-git", "--repository-path", "你的仓库绝对路径"]
  }
  ```

---

## 四、在 Cursor 里怎么加 / 改 MCP

### 方式 A：手写配置文件（推荐，和“市面上多数程序员”用法一致）

1. 打开上面说的路径（项目 `.cursor/mcp.json` 或用户目录下的 `~/.cursor/mcp.json`）。
2. 若没有 `mcp.json`，新建该文件，内容就贴上面「三」里的某一段。
3. 保存后，在 Cursor 中 **Ctrl+Shift+P** → 输入 **“MCP”** → 选 **“Restart MCP Servers”** 或 **“Developer: Reload Window”**。

### 方式 B：用 Cursor 设置界面

1. 打开 **Cursor Settings**（Ctrl+,）。
2. 搜索 **MCP** 或进入 **Features → MCP**。
3. 点 **“+ Add New MCP Server”**，按界面提示填：
   - **Name**：例如 `fetch`
   - **Transport**：选 **stdio**
   - **Command**：`npx`
   - **Arguments**：`-y`, `@modelcontextprotocol/server-fetch`  
   其他 server 同理，对应上面 JSON 里的 `command` 和 `args`。

界面里添加的结果会写入上面的 `mcp.json`，本质和手写一致。

---

## 五、环境要求与常见问题

- **Node.js**：需已安装 Node（建议 18+），且 `npx` 在终端可用。
- **首次运行**：第一次用某个 server 时，`npx -y` 会拉取对应包，可能稍慢。
- **filesystem 报错**：多为路径没写或写错，检查 `args` 里是否至少有一个绝对路径且存在（Windows 用 `D:\\`、`C:\\Users\\xxx\\Desktop` 等形式）。

按上述任选一种方式配置后，Cursor 的 AI 即可使用这些 MCP 能力（浏览网页、读文件、联网搜索等）。
