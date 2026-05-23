#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <admin-domain> <store-domain> [site-name]"
  exit 1
fi

ADMIN_DOMAIN="$1"
STORE_DOMAIN="$2"
SITE_NAME="${3:-c2a-lap}"
ADMIN_PORT="${ADMIN_PORT:-5000}"
STORE_PORT="${STORE_PORT:-5001}"

TMP_FILE="$(mktemp)"

cat > "$TMP_FILE" <<EOF
server {
    listen 80;
    server_name ${ADMIN_DOMAIN};
    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:${ADMIN_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

server {
    listen 80;
    server_name ${STORE_DOMAIN};
    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:${STORE_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

sudo cp "$TMP_FILE" "/etc/nginx/sites-available/${SITE_NAME}"
sudo ln -sf "/etc/nginx/sites-available/${SITE_NAME}" "/etc/nginx/sites-enabled/${SITE_NAME}"
sudo nginx -t
sudo systemctl reload nginx
rm -f "$TMP_FILE"

echo "Nginx site installed."
echo "Run SSL next:"
echo "sudo certbot --nginx -d ${ADMIN_DOMAIN} -d ${STORE_DOMAIN}"
