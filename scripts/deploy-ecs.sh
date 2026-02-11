#!/bin/bash
# 在阿里云 ECS 上一键部署「校园 quiz 提醒」（请在 ECS 远程连接里运行）
# 用法：bash deploy-ecs.sh  或  curl -sL "https://raw.githubusercontent.com/Kie70/-quiz-/main/scripts/deploy-ecs.sh" | bash
set -e

REPO_URL="${REPO_URL:-https://github.com/Kie70/-quiz-.git}"
APP_DIR="/var/www/quiz-helper"
NODE_VERSION="20"

echo "==> 1. 检查/安装 Node.js $NODE_VERSION ..."
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 18 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y nodejs
fi
node -v && npm -v

echo "==> 2. 检查/安装 Git、Nginx ..."
apt-get update -qq && apt-get install -y -qq git nginx

echo "==> 3. 拉取代码到 $APP_DIR ..."
mkdir -p /var/www /data
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR" && git pull
else
  git clone "$REPO_URL" "$APP_DIR" && cd "$APP_DIR"
fi

echo "==> 4. 安装依赖并构建前端 ..."
cd "$APP_DIR"
npm run install:all
NODE_ENV=development npm run build

echo "==> 5. 配置环境变量 ..."
# 优先用 /data/.env（持久化）；无则若 server/.env 存在则自动备份到 /data/.env；否则从模板创建
if [ -f /data/.env ]; then
  cp /data/.env server/.env
  echo "已从 /data/.env 恢复配置"
elif [ -f server/.env ]; then
  cp server/.env /data/.env
  echo "已自动将 server/.env 备份到 /data/.env（下次部署会保持）"
else
  cp server/.env.example server/.env
  JWT=$(openssl rand -hex 16)
  sed -i "s/your-secret-key/$JWT/" server/.env
  echo "PORT=5000" >> server/.env
  echo "NODE_ENV=production" >> server/.env
  echo "DATABASE_PATH=/data/quiz.db" >> server/.env
  cp server/.env /data/.env
  echo "已生成 server/.env 并备份到 /data/.env，请编辑 nano server/.env 填入 SMTP 后执行: cp server/.env /data/.env && pm2 restart quiz-helper"
fi

echo "==> 6. 使用 PM2 启动 ..."
npm install -g pm2 2>/dev/null || true
cd "$APP_DIR"
pm2 delete quiz-helper 2>/dev/null || true
NODE_ENV=production pm2 start server/index.js --name quiz-helper
pm2 save
pm2 startup 2>/dev/null || true

echo "==> 7. 配置 Nginx 反向代理（可选）..."
NGINX_CONF="/etc/nginx/sites-available/quiz-helper"
cat > "$NGINX_CONF" << 'NGINX'
server {
    listen 80 default_server;
    server_name _;
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t && systemctl reload nginx

echo ""
echo "=== 部署完成 ==="
echo "应用已运行在端口 5000，Nginx 已代理 80 端口。"
echo "请确保安全组已放行：22、80、443。"
echo "访问方式： http://你的ECS公网IP"
echo "PM2 查看： pm2 status / pm2 logs quiz-helper"
