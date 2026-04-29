#!/usr/bin/env bash
set -euo pipefail

echo "PM2 status:"
pm2 list || true

echo
echo "Listening ports:"
ss -ltnp | grep -E '(:5000|:5001)' || true

echo
echo "Detected IPs:"
hostname -I || true

echo
echo "Local HTTP checks:"
curl -I http://127.0.0.1:5000/admin || true
curl -I http://127.0.0.1:5001/store || true

echo
echo "If curl works locally but other devices fail:"
echo "1. Check VirtualBox network mode (Bridged is easiest)."
echo "2. Allow ports in firewall: sudo ufw allow 5000/tcp && sudo ufw allow 5001/tcp"
echo "3. Open http://<linux-ip>:5000/admin and http://<linux-ip>:5001/store"
