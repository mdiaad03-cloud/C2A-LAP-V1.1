import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import apiRoutes from "./routes/index.js";
import { env } from "./config/env.js";
import { getDb, initializeDb } from "./data/db.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { syncSalesWorkbook } from "./services/excelAutoSaveService.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve("uploads");

function createApiRateLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    ...(message ? { message: { message, error: message } } : {}),
  });
}

function isPrivateIpv4(hostname) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return false;
  }

  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  if (parts[0] === 10) {
    return true;
  }
  if (parts[0] === 127) {
    return true;
  }
  if (parts[0] === 192 && parts[1] === 168) {
    return true;
  }
  return parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
}

function isAllowedDevOrigin(origin) {
  try {
    const url = new URL(origin);
    const allowedPorts = new Set([env.adminPort, env.storePort, 5173, 5500]);
    const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
    const hostname = String(url.hostname || "").toLowerCase();

    if (!allowedPorts.has(port)) {
      return false;
    }

    return hostname === "localhost" || hostname === "[::1]" || isPrivateIpv4(hostname);
  } catch {
    return false;
  }
}

function isAllowedTunnelOrigin(origin) {
  try {
    const url = new URL(origin);
    const hostname = String(url.hostname || "").toLowerCase();
    return hostname.endsWith(".trycloudflare.com");
  } catch {
    return false;
  }
}

function parseAllowedOrigins(raw) {
  const envOrigins = String(raw || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const localDefaults = [
    `http://localhost:${env.adminPort}`,
    `http://127.0.0.1:${env.adminPort}`,
    `http://localhost:${env.storePort}`,
    `http://127.0.0.1:${env.storePort}`,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
  ];

  return [...new Set([...envOrigins, ...localDefaults])];
}

const allowedOrigins = parseAllowedOrigins(env.corsOrigin);

app.set("trust proxy", 1);

// CORS is required for API requests. Static frontend assets should not be blocked by CORS policies.
app.use(
  "/api",
  cors({
    origin(origin, callback) {
      if (env.allowAllCors) {
        callback(null, true);
        return;
      }

      if (
        !origin
        || allowedOrigins.length === 0
        || allowedOrigins.includes(origin)
        || isAllowedDevOrigin(origin)
        || isAllowedTunnelOrigin(origin)
      ) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed by CORS policy."));
    },
    credentials: false,
  }),
);

app.use(helmet());
app.use(compression());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.use("/api/auth/login", createApiRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many login attempts. Try again later.",
}));

app.use("/api/store/checkout", createApiRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many checkout attempts. Please try again shortly.",
}));

app.use("/api/customer-auth", createApiRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many authentication attempts. Try again later.",
}));

app.use("/api/support/tickets", createApiRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: "Too many support requests. Please wait and try again.",
}));

app.use("/api/store/products/:id/reviews", createApiRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many review attempts. Try again later.",
}));

app.use("/api", createApiRateLimiter({
  windowMs: 60 * 1000,
  max: 300,
}));

app.use("/api", apiRoutes);
app.use("/uploads", express.static(uploadsDir));

const clientDist = path.resolve(__dirname, "../../client/dist");
app.use((req, _res, next) => {
  // Compatibility: if a cached/legacy index requests nested asset paths,
  // rewrite them to root-level Vite assets to avoid blank screens.
  if (req.url.startsWith("/admin/assets/")) {
    req.url = req.url.replace("/admin/assets/", "/assets/");
  } else if (req.url.startsWith("/store/assets/")) {
    req.url = req.url.replace("/store/assets/", "/assets/");
  } else if (req.url === "/admin/vite.svg" || req.url === "/store/vite.svg") {
    req.url = "/vite.svg";
  }
  next();
});
app.use(express.static(clientDist));

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }

  const currentPort = Number(req.socket.localPort || env.adminPort);
  const isAdminPort = currentPort === env.adminPort;
  const isStorePort = currentPort === env.storePort;

  if (env.adminPort !== env.storePort && isAdminPort && req.path.startsWith("/store")) {
    return res.status(404).send("Storefront is isolated from admin port.");
  }

  if (env.adminPort !== env.storePort && isStorePort && req.path.startsWith("/admin")) {
    return res.status(404).send("Admin dashboard is isolated from storefront port.");
  }

  if (req.path === "/") {
    if (isStorePort) {
      return res.redirect("/store");
    }
    return res.redirect("/admin");
  }

  return res.sendFile(path.join(clientDist, "index.html"), (error) => {
    if (error) {
      res.status(200).send("C2A LAP API is running. Build client to serve frontend.");
    }
  });
});

app.use(notFound);
app.use(errorHandler);

async function bootstrap() {
  await initializeDb();
  const db = await getDb();
  try {
    await syncSalesWorkbook(db.sales || []);
  } catch (error) {
    console.error("Initial Excel sync failed:", error);
  }

  const ports = [env.adminPort, env.storePort];
  const uniquePorts = [...new Set(ports)];

  for (const port of uniquePorts) {
    app.listen(port, env.host, () => {
      if (port === env.adminPort && port === env.storePort) {
        console.log(`Admin + Store + API running on http://${env.host}:${port}`);
      } else if (port === env.adminPort) {
        console.log(`Admin + API running on http://${env.host}:${port}`);
      } else if (port === env.storePort) {
        console.log(`Storefront running on http://${env.host}:${port}`);
      } else {
        console.log(`Server running on http://${env.host}:${port}`);
      }
    });
  }
}

bootstrap();
