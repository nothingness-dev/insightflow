#!/usr/bin/env bash
# InsightFlow one-command deploy for Linux.
# Usage:  ./deploy.sh
set -euo pipefail

echo "==> Building and starting containers..."
docker compose up -d --build

echo "==> Waiting for the backend to become healthy..."
sleep 8

echo "==> Applying database migrations (creates JWT blacklist tables)..."
docker compose exec -T backend python manage.py migrate

echo ""
echo "============================================================"
echo " InsightFlow is running."
echo " Open:  http://Your-Choice  (or http://172.16.4.10)"
echo " Admin: username/password from your .env file"
echo "============================================================"
