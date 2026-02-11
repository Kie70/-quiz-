#!/bin/bash
# 更新代码（保留 .env 配置）
# 用法：cd /var/www/quiz-helper && bash scripts/update-ecs.sh
set -e

APP_DIR="${APP_DIR:-/var/www/quiz-helper}"
cd "$APP_DIR"

# 配置同步：有 /data/.env 则恢复；无则若 server/.env 存在则备份到 /data/.env
if [ -f /data/.env ]; then
  cp /data/.env server/.env
  echo "已从 /data/.env 恢复配置"
elif [ -f server/.env ]; then
  cp server/.env /data/.env
  echo "已自动将 server/.env 备份到 /data/.env"
fi

git pull
npm run install:all
NODE_ENV=development npm run build
pm2 restart quiz-helper
echo "更新完成"
