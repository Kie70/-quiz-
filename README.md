# XJTLU Quiz Helper

课程提醒 Web 应用：录入课程表，在每周上课前 5 分钟自动发送邮件提醒 Quiz。  
前端 React (Vite) + 后端 Node.js (Express) + SQLite。

## 快速开始

```bash
npm run install:all   # 根目录 + server + client 安装依赖
npm run dev           # 同时启动 client :3000 与 server :5000
```

登录：使用 `@xjtlu.edu.cn` 或 `@student.xjtlu.edu.cn` 邮箱；验证码在**运行后端的终端**中打印。

## 真实邮件发送（SMTP）

未配置 SMTP 时，系统仅在控制台输出 `Email Sent to [邮箱] for [课程]`，不会真正发信。

**启用真实发信：**

1. 在 `server/` 目录下复制环境变量示例并编辑：
   ```bash
   cp server/.env.example server/.env
   ```
2. 在 `server/.env` 中填写 SMTP 信息，例如：
   - **学校/企业邮箱**：使用该邮箱服务商提供的 SMTP 地址、端口、账号与密码（或授权码）。
   - **SendGrid / Mailgun 等**：使用其提供的 SMTP 或 API 文档中的发信方式。
3. 重启后端服务。配置正确后，到达提醒时间会向用户邮箱真实发送邮件。

| 变量 | 说明 |
|------|------|
| `SMTP_HOST` | SMTP 服务器地址 |
| `SMTP_PORT` | 端口（常见 587 / 465） |
| `SMTP_USER` | 登录用户名 |
| `SMTP_PASS` | 登录密码或授权码 |
| `SMTP_FROM` | 发件人邮箱（部分服务要求与 USER 一致） |

## 项目结构

- `client/` — Vite + React 前端（端口 3000）
- `server/` — Express API + SQLite + 定时任务（端口 5000）
- 数据库文件：`server/data/quiz.db`（自动创建）
