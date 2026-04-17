#!/usr/bin/env bash

set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-scout.kafu.kz}"
DEPLOY_PORT="${DEPLOY_PORT:-2251}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/scout}"
DEPLOY_SERVICE="${DEPLOY_SERVICE:-scout}"

ssh -p "$DEPLOY_PORT" "$DEPLOY_USER@$DEPLOY_HOST" \
  "cd '$DEPLOY_PATH' && docker compose pull '$DEPLOY_SERVICE' && docker compose up -d --force-recreate '$DEPLOY_SERVICE' && docker inspect --format='{{.Image}}' \"\$(docker compose ps -q '$DEPLOY_SERVICE')\""
