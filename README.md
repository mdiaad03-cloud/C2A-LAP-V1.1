# 🚀 C2A LAP Project

Full Stack Web Application for sales management and customer storefront, built using a modern Client–Server Architecture.

---

## 🧠 System Architecture

![Full Stack Architecture](./docs/architecture.png)

---

## 📌 Overview

The system provides a unified data source for:

* Admin users
* Products
* Sales
* Shipping
* Online orders
* Storefront settings

---

## ⚙️ Architecture Flow

Client (React + Vite)
↓
Server (Node.js + Express REST API)
↓
Database Layer (lowdb / JSON)

---

## 🛠️ Technologies

### 🎨 Frontend

* React
* Vite
* Axios
* Framer Motion

### ⚙️ Backend

* Node.js
* Express
* lowdb
* JWT Authentication
* bcryptjs
* multer

### 🔐 Security & Middleware

* morgan (logging)
* helmet (security headers)
* rate limiting
* CSRF protection

---

## 🔗 API Endpoints

* /api/auth
* /api/users
* /api/products
* /api/sales
* /api/shipping
* /api/online-orders
* /api/store

---

## 📁 Project Structure

```
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

---

## ▶️ How To Run

### Install dependencies

```
npm run install:all
```

### Development

```
npm run dev
```

### Production

```
npm run build
npm run start
```

---

## 🖥️ Local URLs

* Admin Dashboard → http://localhost:5000/admin
* Storefront → http://localhost:5001/store

---

## 🔐 Security Features

* JWT Authentication
* Role-based authorization
* CSRF protection
* Rate limiting
* Request logging
* Secure headers

---

## 👨‍💻 Author

Mohamed diaa
ID: 2024030095
Badr University
Section Z1

---

## 🏁 Conclusion

This project demonstrates a scalable full stack architecture with clean separation of concerns, secure API design, and production-ready structure.
