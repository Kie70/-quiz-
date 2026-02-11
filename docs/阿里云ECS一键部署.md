# 阿里云 ECS 一键部署（操控面板完成）

你已开通 ECS，按下面在**阿里云控制台**里操作即可完成部署，无需本机 SSH。

---

## 一、打开 ECS 远程连接（在控制台里“操控面板”）

1. 登录 [阿里云控制台](https://ecs.console.aliyun.com) 。
2. 左侧 **实例与镜像 → 实例**，找到你已开通的 ECS，记下 **公网 IP**。
3. 点击该实例 **ID** 或 **管理** 进入详情。
4. 左侧点 **远程连接**（或 **通过 Workbench 连接** / **通过 VNC 连接**）。
5. 选择 **通过 Workbench 远程连接**（或 **VNC**），输入实例密码（若提示），进入 **黑屏终端**（Linux 命令行）。

接下来所有“操控”都在这个终端里完成。

---

## 二、首次使用：安装基础环境（只需做一次）

在远程连接终端里**逐行粘贴**执行（建议用 root，或命令前加 `sudo`）：

```bash
# 更新并安装 curl、git
apt update && apt install -y curl git
```

然后执行**一键部署脚本**（见下一节）。

若你希望**完全手动画板操作、不复制脚本**，可改为在控制台里：

- 用 **云助手**（若有）：在实例详情里找到 **云助手** → **发送命令**，选择「运行 Shell 脚本」，把下面「三、一键部署」里的脚本内容粘贴进去执行。
- 或只用 **远程连接** 终端，一段段粘贴「三、一键部署」里的命令块。

---

## 三、一键部署（在终端里执行）

在**同一台 ECS 的远程连接终端**里，**整段复制**下面这一整块，粘贴到终端回车执行即可（约 2～5 分钟）：

```bash
# 一键部署（仓库地址可按需改 REPO_URL）
REPO_URL="https://github.com/Kie70/-quiz-.git"
APP_DIR="/var/www/quiz-helper"
apt update -qq && apt install -y -qq curl git nginx

# Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs

mkdir -p /var/www /data && cd /var/www
if [ -d "$APP_DIR/.git" ]; then cd "$APP_DIR" && git pull; else git clone "$REPO_URL" "$APP_DIR" && cd "$APP_DIR"; fi

cd "$APP_DIR"
npm run install:all
NODE_ENV=development npm run build

# 优先用 /data/.env；无则若 server/.env 存在则自动备份到 /data/.env；否则从模板创建
if [ -f /data/.env ]; then cp /data/.env server/.env; elif [ -f server/.env ]; then cp server/.env /data/.env; else cp server/.env.example server/.env && sed -i "s/your-secret-key/$(openssl rand -hex 16)/" server/.env && echo -e "PORT=5000\nNODE_ENV=production\nDATABASE_PATH=/data/quiz.db" >> server/.env && cp server/.env /data/.env; fi

npm i -g pm2 2>/dev/null; pm2 delete quiz-helper 2>/dev/null; NODE_ENV=production pm2 start server/index.js --name quiz-helper; pm2 save

cat > /etc/nginx/sites-available/quiz-helper << 'EOF'
server { listen 80 default_server; server_name _; location / { proxy_pass http://127.0.0.1:5000; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-Proto $scheme; } }
EOF
ln -sf /etc/nginx/sites-available/quiz-helper /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default 2>/dev/null
nginx -t && systemctl reload nginx

echo "完成。访问: http://$(curl -s ifconfig.me)"
```

执行完后，终端最后会打印：**完成。访问: http://你的公网IP**。用浏览器打开该地址即可使用。

---

## 四、安全组（在控制台面板里点选）

若打不开上述地址，需要在控制台**放行端口**：

1. 在 ECS 实例详情里点 **安全组** → 进入安全组。
2. **入方向** → **手动添加**：
   - 端口：**80**，授权对象：**0.0.0.0/0**
   - 端口：**443**（若以后上 HTTPS），授权对象：**0.0.0.0/0**
   - 端口 **22** 一般已开放（远程连接用）。

保存后，再访问 **http://你的ECS公网IP** 即可。

---

## 五、以后更新代码（继续在面板里操作）

在**同一台 ECS 的远程连接**终端里执行：

```bash
cd /var/www/quiz-helper && ([ -f /data/.env ] && cp /data/.env server/.env || [ -f server/.env ] && cp server/.env /data/.env) && git pull && npm run install:all && NODE_ENV=development npm run build && pm2 restart quiz-helper
```

说明：命令会先同步配置（有 `/data/.env` 则恢复，否则将 `server/.env` 备份到 `/data/.env`），无需手动执行 `cp`。

或使用脚本：`bash scripts/update-ecs.sh`（效果相同）。

---

## 六、常用命令（都在 ECS 终端里）

| 操作       | 命令 |
|------------|------|
| 看应用状态 | `pm2 status` |
| 看日志     | `pm2 logs quiz-helper` |
| 重启应用   | `pm2 restart quiz-helper` |
| 改环境变量 | `nano /var/www/quiz-helper/server/.env` 保存后执行 `pm2 restart quiz-helper` |

**环境变量说明**（在 `server/.env` 中配置）：
- `DATABASE_PATH=/data/quiz.db`：数据库持久化到 /data，更新代码时数据不丢失
- `ADMIN_EMAILS=你的邮箱@xjtlu.edu.cn`：管理员邮箱，逗号分隔，用于访问管理后台

**配置持久化**：首次配置好 `server/.env`（SMTP、JWT 等）后，执行 `cp server/.env /data/.env`，此后更新代码会自动从 `/data/.env` 恢复，无需重复配置。

详见 [持久稳定与运维指南](./持久稳定与运维指南.md)。

按上述步骤在**阿里云 ECS 控制台 + 远程连接**里操作，即可由你“操控面板”把项目部署到已开通的 ECS 上；无需本机 SSH，全部在网页里完成。
