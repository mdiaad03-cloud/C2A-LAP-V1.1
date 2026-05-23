#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$ROOT_DIR"

if [[ ! -f "$ROOT_DIR/server/.env" ]]; then
  echo "Missing server/.env"
  echo "Create it first: cp server/.env.example server/.env"
  exit 1
fi

mkdir -p "$ROOT_DIR/server/uploads" "$ROOT_DIR/server/exports"

npm --prefix server install
npm --prefix client install
npm --prefix client run build

pm2 startOrRestart "$ROOT_DIR/deploy/linux/ecosystem.config.cjs"
pm2 save

echo "Deploy complete."
echo "Admin:  http://127.0.0.1:5000/admin"
echo "Store:  http://127.0.0.1:5001/store"
