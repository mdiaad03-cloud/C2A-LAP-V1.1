# C2A LAP

Sales management dashboard and customer storefront for **C2A LAP**.
## 🧠 System Architecture

![Architecture](./docs/architecture.png)

The project keeps one shared data source for:
- admin users
- products
- sales
- shipping
- online orders
- storefront settings

## Architecture

```text
Client (React + Vite)
        |
        v
Server (Node.js + Express REST API)
        |
        v
DB Layer (lowdb / JSON file)
```

## Technologies

### Client
- React
- Vite
- Axios
- Framer Motion

### Server
- Node.js
- Express
- lowdb
- JWT
- bcryptjs
- multer
- morgan
- helmet

## API Overview

Main REST entry points:
- `/api/auth`
- `/api/users`
- `/api/products`
- `/api/sales`
- `/api/shipping`
- `/api/online-orders`
- `/api/store`

## Project Structure

```text
client/
  src/
    components/
    context/
    sections/
    store/

server/
  src/
    config/
    data/
    middleware/
    routes/
    services/
    utils/
```

## How To Run

### 1. Install dependencies
```bash
npm run install:all
```

### 2. Development run
```bash
npm run dev
```

### 3. Production build
```bash
npm run build
npm run start
```

### Windows helper scripts
```bash
run-clean-app.bat
run-server.bat
run-client.bat
```

## Default Local URLs

- Admin dashboard: `http://localhost:5000/admin`
- Storefront: `http://localhost:5001/store`

## Security Notes

The project already includes:
- JWT authentication
- role-based authorization
- CSRF protection for write actions
- rate limiting
- request logging with `morgan`
- security headers with `helmet`

## Author

- **Mohamed diaa**
- **ID:** 2024030095
- **Badr University**
- **Section:** Z1

