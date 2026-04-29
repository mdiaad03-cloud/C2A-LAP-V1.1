#!/usr/bin/env bash
set -euo pipefail

NODE_MAJOR="${NODE_MAJOR:-20}"

sudo apt-get update
sudo apt-get install -y curl ca-certificates gnupg git nginx certbot python3-certbot-nginx build-essential

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is missing after Node.js installation."
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

echo "Bootstrap complete."
echo "Next:"
echo "1. Clone the repo to /var/www/c2a-lap"
echo "2. Copy server/.env.example to server/.env and edit production values"
echo "3. Run deploy/linux/deploy.sh"
echo "4. Run deploy/linux/install-nginx-site.sh <admin-domain> <store-domain>"
