# Linux Deployment

This project now includes Linux-ready scripts in `deploy/linux`.

## 1. Prepare Ubuntu

```bash
chmod +x deploy/linux/*.sh
sudo bash deploy/linux/bootstrap-ubuntu.sh
```

## 2. Clone the project

```bash
sudo mkdir -p /var/www
sudo chown -R "$USER":"$USER" /var/www
cd /var/www
git clone <YOUR_REPO_URL> c2a-lap
cd c2a-lap
```

## 3. Configure environment

```bash
cp server/.env.example server/.env
nano server/.env
```

Recommended production values:

```env
HOST=0.0.0.0
PORT=5000
ADMIN_PORT=5000
STORE_PORT=5001
JWT_SECRET=replace-with-a-long-random-secret
CORS_ORIGIN=https://admin.example.com,https://store.example.com
STORE_BASE_URL=https://store.example.com
GOOGLE_REDIRECT_URI=https://store.example.com/api/customer-auth/google/callback
FACEBOOK_REDIRECT_URI=https://store.example.com/api/customer-auth/facebook/callback
MAIL_FROM="C2A LAP <no-reply@example.com>"
```

## 4. Build and start

```bash
bash deploy/linux/deploy.sh
bash deploy/linux/check.sh
pm2 startup
```

If `pm2 startup` prints a command, run that command once, then:

```bash
pm2 save
```

## 5. Configure Nginx

```bash
sudo bash deploy/linux/install-nginx-site.sh admin.example.com store.example.com
```

## 6. Enable SSL

```bash
sudo certbot --nginx -d admin.example.com -d store.example.com
```

## 7. Update deployment

```bash
cd /var/www/c2a-lap
git pull
bash deploy/linux/deploy.sh
```

## Notes

- Admin runs on `5000`
- Store runs on `5001`
- Admin URL: `https://admin.example.com/admin`
- Store URL: `https://store.example.com/store`
- The data layer is file-based, so keep backups of `server/src/data/db.json` and `server/exports/`
- For LAN access from VirtualBox, use `Bridged Adapter` or configure NAT port forwarding
