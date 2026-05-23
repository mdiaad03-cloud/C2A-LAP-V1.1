import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import paymobRoutes from "./routes/paymobRoutes.js";
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

app.use(
  "/api",
  cors((req, callback) => {
    const origin = req.header("Origin");
    const host = req.headers.host;
    const isSameOrigin = origin && (origin === `http://${host}` || origin === `https://${host}`);

    let allowed = false;
    if (
      env.allowAllCors
      || !origin
      || isSameOrigin
      || allowedOrigins.includes(origin)
      || isAllowedDevOrigin(origin)
      || isAllowedTunnelOrigin(origin)
    ) {
      allowed = true;
    }

    callback(null, {
      origin: allowed,
      credentials: false,
    });
  }),
);

app.use(helmet());
app.use(compression());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.use(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many login attempts. Try again later." },
    skip: () => env.disableRateLimits,
  }),
);

app.post(
  "/api/store/checkout",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many checkout attempts. Please try again shortly." },
    skip: () => env.disableRateLimits,
  }),
);

app.use(
  "/api/customer-auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many authentication attempts. Try again later." },
    skip: () => env.disableRateLimits,
  }),
);

app.post(
  "/api/support/tickets",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many support requests. Please wait and try again." },
    skip: () => env.disableRateLimits,
  }),
);

app.post(
  "/api/store/products/:id/reviews",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many review attempts. Try again later." },
    skip: () => env.disableRateLimits,
  }),
);

app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    max: 10000, // Increased to support high concurrent dashboard requests
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      if (env.disableRateLimits) return true;
      // Skip rate limit for authenticated admin/staff dashboard requests
      const auth = req.headers.authorization || "";
      return auth.startsWith("Bearer ");
    },
  }),
);

// Image proxy to load external product images through our server
app.get("/api/image-proxy", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl || typeof targetUrl !== "string") {
    return res.status(400).json({ error: "Missing url parameter." });
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: "Invalid URL." });
    }
  } catch {
    return res.status(400).json({ error: "Invalid URL." });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
        "Referer": parsed.origin,
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(502).json({ error: "Failed to fetch image." });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    if (err.name === "AbortError") {
      return res.status(504).json({ error: "Image fetch timed out." });
    }
    return res.status(502).json({ error: "Failed to fetch image." });
  }
});

// Google Site Verification, robots.txt, and sitemap.xml direct endpoints
app.get("/google0ba802e198b6f55a.html", (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send("google-site-verification: google0ba802e198b6f55a.html");
});

app.get("/robots.txt", (req, res) => {
  res.setHeader("Content-Type", "text/plain");
  res.send("User-agent: *\nAllow: /\nSitemap: https://c2a-lap-v11-production.up.railway.app/sitemap.xml\n");
});

app.get("/sitemap.xml", (req, res) => {
  res.setHeader("Content-Type", "application/xml");
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://c2a-lap-v11-production.up.railway.app/store</loc>
    <lastmod>2026-05-23</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://c2a-lap-v11-production.up.railway.app/store/products</loc>
    <lastmod>2026-05-23</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://c2a-lap-v11-production.up.railway.app/store/support</loc>
    <lastmod>2026-05-23</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://c2a-lap-v11-production.up.railway.app/store/account</loc>
    <lastmod>2026-05-23</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>`);
});

app.use("/api", apiRoutes);
app.use("/api/paymob", paymobRoutes);
app.use("/uploads", express.static(uploadsDir, { dotfiles: 'allow' }));

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
app.use(express.static(clientDist, { dotfiles: 'allow' }));

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }

  const currentPort = Number(req.socket.localPort || env.adminPort);
  const isAdminPort = currentPort === env.adminPort;
  const isStorePort = currentPort === env.storePort;

  if (env.adminPort !== env.storePort && isAdminPort && req.path.startsWith("/store")) {
    const host = req.headers.host ? req.headers.host.split(":")[0] : "localhost";
    return res.redirect(`http://${host}:${env.storePort}${req.originalUrl}`);
  }

  if (env.adminPort !== env.storePort && isStorePort && req.path.startsWith("/admin")) {
    const host = req.headers.host ? req.headers.host.split(":")[0] : "localhost";
    return res.redirect(`http://${host}:${env.adminPort}${req.originalUrl}`);
  }

  if (req.path === "/") {
    if (isStorePort) {
      return res.redirect("/store");
    }
    return res.redirect("/admin");
  }

  const resolvedPath = path.join(clientDist, "index.html");
  console.log("Attempting to sendFile:", resolvedPath);
  return res.sendFile(resolvedPath, { dotfiles: 'allow' }, (error) => {
    if (error) {
      console.error("sendFile error details:", error);
      console.error("File exists check:", fs.existsSync(resolvedPath));
      res.status(200).send("C2A LAP API is running. Build client to serve frontend. Error: " + error.message + " Path: " + resolvedPath);
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

  // Initialize automated backups scheduler
  try {
    const { scheduleAutomatedBackups } = await import("./services/backupScheduler.js");
    scheduleAutomatedBackups();
  } catch (scheduleErr) {
    console.error("Failed to initialize backup scheduler:", scheduleErr);
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
