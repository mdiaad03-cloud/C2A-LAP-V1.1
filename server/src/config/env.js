import dotenv from "dotenv";

dotenv.config();

export const env = {
  host: process.env.HOST || "0.0.0.0",
  port: Number(process.env.PORT || 5000),
  adminPort: Number(process.env.ADMIN_PORT || process.env.PORT || 5000),
  storePort: Number(process.env.STORE_PORT || 5001),
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  allowAllCors:
    String(process.env.CORS_ALLOW_ALL || "").toLowerCase() === "true"
    || String(process.env.CORS_ORIGIN || "").trim() === "*",
  storeBaseUrl: process.env.STORE_BASE_URL || "http://localhost:5001",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || "http://localhost:5000/api/customer-auth/google/callback",
  facebookAppId: process.env.FACEBOOK_APP_ID || "",
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET || "",
  facebookRedirectUri: process.env.FACEBOOK_REDIRECT_URI || "http://localhost:5000/api/customer-auth/facebook/callback",
  smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
  smtpPort: Number(process.env.SMTP_PORT || 465),
  smtpSecure: String(process.env.SMTP_SECURE || "true").toLowerCase() !== "false",
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  mailFrom: process.env.MAIL_FROM || "",
};
