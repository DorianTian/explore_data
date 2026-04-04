#!/bin/bash
# NL2SQL — 部署脚本
# Usage: ssh ubuntu@<ec2-ip> 'bash -s' < deploy.sh
#
# 前置条件:
#   1. EC2 已安装 Node.js 22+, pnpm, PM2, Nginx
#   2. RDS PostgreSQL 可达 (同 ask-dorian 共用)
#   3. .env 已配置在 /opt/aix-ops-hub/nl2sql/.env

set -euo pipefail

APP_DIR="/opt/aix-ops-hub/nl2sql"
LOG_DIR="/opt/aix-ops-hub/logs"

echo "=== NL2SQL Deploy ==="

# 1. Ensure directories
mkdir -p "$LOG_DIR"

# 2. Pull latest code
cd "$APP_DIR"
git pull origin main

# 3. Install dependencies
pnpm install --frozen-lockfile

# 4. Build all packages (shared → db → engine → api → web)
echo "📦 Building all packages..."
pnpm build

# 5. Run database migration
if [ "${RUN_MIGRATION:-false}" = "true" ]; then
    echo "📦 Running database migration..."
    pnpm db:migrate
fi

# 6. Restart PM2
pm2 startOrRestart ecosystem.config.cjs --env production
pm2 save

# 7. Health check — API
echo "⏳ Waiting for API to start..."
sleep 3
if curl -sf http://localhost:3100/health > /dev/null 2>&1; then
    echo "✅ API health check passed (port 3100)"
else
    echo "❌ API health check FAILED! Check: pm2 logs nl2sql-api --lines 50"
    exit 1
fi

# 8. Health check — Web
if curl -sf http://localhost:3001 > /dev/null 2>&1; then
    echo "✅ Web health check passed (port 3001)"
else
    echo "⚠️  Web health check failed — may still be starting. Check: pm2 logs nl2sql-web --lines 50"
fi

echo ""
echo "✅ Deploy complete!"
echo ""
echo "Useful commands:"
echo "  pm2 status                    — 查看进程状态"
echo "  pm2 logs nl2sql-api --lines 50 — 查看 API 日志"
echo "  pm2 logs nl2sql-web --lines 50 — 查看 Web 日志"
