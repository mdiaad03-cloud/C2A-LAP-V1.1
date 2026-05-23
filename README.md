# C2A LAP - Sales Management System

Proprietary internal and storefront platform built exclusively for **C2A LAP**.

Development ownership note:
- Developer: **Mohamed Diaa El Deen Samy** (`محمد ضياء الددين سامي`)
- Role: **Freelance Developer**
- Usage: **This website and platform are dedicated to C2A LAP only**

Professional sales management web application for a laptop business.

## Stack
- Frontend: React + Vite + Recharts + Framer Motion
- Backend: Node.js + Express + JWT + role-based permissions
- Data Layer: JSON database (lowdb) with backup endpoint

## Accounts (Seeded)
- Admin: `mdiaad03` / `#Ds228281`
- Sales: `metwally` / `Wasta`
- Sales: `Araby` / `269206mo`

## Core Features
- Secure authentication (JWT + bcrypt)
- CSRF token validation for write actions
- Role-based access control (`admin`, `sales`)
- Sales records with auto profit calculation
- Warranty calculations and expiry status
- Shipping company management
- Contacts CRM with purchase history
- Excel upload for product catalog (flexible column names + auto price normalization)
- Product catalog controls: delete single product or clear all products
- Dashboard KPI cards and interactive charts
- Admin profits analytics and exports (PDF / Excel)
- Activity logs and notifications
- Backup download endpoint
- Auto-synced sales Excel file (`server/exports/sales_autosave.xlsx`)
- Responsive modern UI with dark/light mode
- Customer-facing online store (`/store`) with:
  - Homepage hero slider, featured products, offers, brands
  - Products list with search + filters (brand, RAM, storage, price range)
  - Product details with gallery/specs/warranty/shipping/reviews
  - Cart + checkout + payment step
  - Customer account system (register/login)
  - Full customer profile (contact data, avatar, city/address, password change)
  - Social login endpoints (Google/Facebook when configured)
  - Support / complaints page and ticket replies
  - Arabic/English toggle and auto currency display (EGP + GCC currencies)
  - Category filter
- Online order workflow integrated with admin dashboard:
  - New `Online Orders` section for pending/confirmed/shipped/delivered/cancelled
  - Auto stock reservation on checkout
  - Sales sync from checkout (assigned to Online Store employee or selected sales rep)
  - Stock restore + sales rollback on order cancellation
  - Online conversion and revenue analytics
- Product management enhancements:
  - Edit existing products (price/stock/specs/discount/etc.)
  - Upload product images per laptop
- Customer support dashboard section for admins
- Store customization dashboard section for admins:
  - Edit storefront texts (hero, CTA labels, section titles)
  - Manage store categories

## Run Locally

### 0) Prerequisite
- Install Node.js 20+ (npm is included): https://nodejs.org

### 1) Install Dependencies
```bash
npm run install:all
```

### 2) Development
```bash
npm run dev
```
- Admin + API: `http://localhost:5000`
  - Admin Dashboard: `http://localhost:5000/admin`
- Storefront: `http://localhost:5001`
  - Customer Storefront: `http://localhost:5001/store`

Windows quick start without PATH setup:
```bash
run-dev.bat
```

Windows quick run (build + start server):
```bash
run-app.bat
```
Then open:
- Admin `http://localhost:5000/admin`
- Store `http://localhost:5001/store`

Important isolation behavior:
- `http://localhost:5000` is for admin/API.
- `http://localhost:5001` is for storefront.
- `/admin` on store port is blocked by design.
- `/store` on admin port is blocked by design.

If you have stuck processes or repeated port conflicts:
```bash
run-clean-app.bat
```

## Production Build
```bash
npm run build
npm run start
```

The server serves `client/dist` automatically after build.

## Docker Deployment
```bash
docker compose up --build -d
```
App will run on `http://localhost:5000`.

## Linux Deployment

Ready-made Linux deployment scripts are included in:

```bash
deploy/linux/
```

Full guide:

```bash
docs/LINUX_DEPLOY.md
```

## Environment
Copy `server/.env.example` to `server/.env` and set values.

Important env keys for new features:
- `HOST` (recommended `0.0.0.0` on Linux)
- `ADMIN_PORT` (default `5000`)
- `STORE_PORT` (default `5001`)
- `STORE_BASE_URL` (default `http://localhost:5001`)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_REDIRECT_URI`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`

## Deploy (Vercel + Render + Domain)
1. Push project to GitHub.
2. Deploy backend (`/server`) on Render:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Set env vars from `server/.env.example`.
3. Deploy frontend (`/client`) on Vercel:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Configure proxy/API base to your Render backend domain.
4. Domain setup:
   - Add your domain in Vercel project settings.
   - Add `A`/`CNAME` DNS records from Vercel instructions.
5. Gmail order emails:
   - Use Gmail App Password (2FA enabled).
   - Set `SMTP_USER` to your Gmail, `SMTP_PASS` to app password.
   - Set `MAIL_FROM` to branded sender string.

## Important Note
Current data layer is file-based for quick deployment and demo stability.
For enterprise production, migrate to PostgreSQL/MySQL while preserving the same API contract.
