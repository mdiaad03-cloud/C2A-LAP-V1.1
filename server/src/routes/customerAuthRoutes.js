import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { Router } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { env } from "../config/env.js";
import { getDb, saveDb } from "../data/db.js";
import { addLog } from "../services/logService.js";
import { createCsrfToken } from "../utils/csrf.js";
import { nowIso } from "../utils/dateUtils.js";
import { signAuthToken } from "../utils/jwt.js";
import { publicUser } from "../utils/userSanitize.js";
import {
  asOptionalText,
  requireEmail,
  requireMinLength,
  requireText,
  sanitizeCountry,
  sanitizeText,
} from "../utils/validation.js";

const router = Router();

const avatarUploadDir = path.resolve("uploads", "avatars");
if (!fs.existsSync(avatarUploadDir)) {
  fs.mkdirSync(avatarUploadDir, { recursive: true });
}

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, avatarUploadDir),
    filename: (req, file, cb) => {
      const extension = path.extname(file.originalname || "").toLowerCase();
      const safeExtension = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extension)
        ? extension
        : ".jpg";
      cb(null, `${Date.now()}-${nanoid(8)}${safeExtension}`);
    },
  }),
  limits: {
    fileSize: 4 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    const mime = String(file.mimetype || "").toLowerCase();
    if (mime.startsWith("image/")) {
      callback(null, true);
      return;
    }
    callback(new Error("Only image files are allowed."));
  },
});

function normalizeUsernameCandidate(email) {
  const prefix = String(email || "")
    .split("@")[0]
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .toLowerCase()
    .slice(0, 20);
  return prefix || "customer";
}

function uniqueUsername(db, base) {
  let candidate = base;
  let suffix = 1;
  while (db.users.some((entry) => String(entry.username || "").toLowerCase() === candidate.toLowerCase())) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  return candidate;
}

const ALLOWED_GENDERS = new Set(["", "male", "female", "other", "prefer_not_to_say"]);

function sanitizeBirthDate(value) {
  const date = asOptionalText(value);
  if (!date) {
    return "";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Birth date must be in YYYY-MM-DD format.");
  }
  return date;
}

function sanitizeGender(value) {
  const normalized = asOptionalText(value).toLowerCase();
  if (!ALLOWED_GENDERS.has(normalized)) {
    throw new Error("Gender is invalid.");
  }
  return normalized;
}

function applyProfileFields(user, payload = {}) {
  if (payload.name !== undefined) {
    user.name = requireText(payload.name, "Name");
  }
  if (payload.phone !== undefined) {
    user.phone = asOptionalText(payload.phone);
  }
  if (payload.country !== undefined) {
    user.country = sanitizeCountry(payload.country);
  }
  if (payload.address !== undefined) {
    user.address = asOptionalText(payload.address);
  }
  if (payload.city !== undefined) {
    user.city = asOptionalText(payload.city);
  }
  if (payload.gender !== undefined) {
    user.gender = sanitizeGender(payload.gender);
  }
  if (payload.birthDate !== undefined) {
    user.birthDate = sanitizeBirthDate(payload.birthDate);
  }
  if (payload.avatarUrl !== undefined) {
    user.avatarUrl = asOptionalText(payload.avatarUrl);
  }
  if (payload.addresses !== undefined) {
    if (Array.isArray(payload.addresses)) {
      user.addresses = payload.addresses.map(addr => ({
        id: addr.id || nanoid(),
        label: String(addr.label || "").trim() || "Address",
        address: String(addr.address || "").trim(),
        city: String(addr.city || "").trim(),
        country: sanitizeCountry(addr.country || "EG"),
      }));
    } else {
      user.addresses = [];
    }
  }
}

function issueSession(user) {
  const csrfToken = createCsrfToken();
  const token = signAuthToken({
    sub: user.id,
    role: user.role,
    csrf: csrfToken,
  });
  return { token, csrfToken, user: publicUser(user) };
}

async function upsertSocialCustomer(db, profile, provider) {
  const email = requireEmail(profile.email, "Social email");
  const name = sanitizeText(profile.name || email.split("@")[0]);
  let user = db.users.find((entry) => String(entry.email || "").toLowerCase() === email.toLowerCase());

  if (!user) {
    const username = uniqueUsername(db, normalizeUsernameCandidate(email));
    user = {
      id: nanoid(),
      name,
      username,
      email,
      phone: "",
      country: "",
      address: "",
      city: "",
      gender: "",
      birthDate: "",
      avatarUrl: "",
      addresses: [],
      passwordHash: await bcrypt.hash(`oauth-${provider}-${nanoid()}`, 10),
      role: "customer",
      authProvider: provider,
      isActive: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastLoginAt: null,
    };
    db.users.push(user);
  } else {
    user.name = name || user.name;
    user.authProvider = provider;
    user.address ||= "";
    user.city ||= "";
    user.country ||= "";
    user.gender ||= "";
    user.birthDate ||= "";
    user.avatarUrl ||= "";
    user.addresses ||= [];
    user.updatedAt = nowIso();
  }

  user.lastLoginAt = nowIso();
  return user;
}

async function verifyGoogleIdToken(idToken) {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(String(idToken || ""))}`,
  );
  if (!response.ok) {
    throw new Error("Invalid Google token.");
  }
  const data = await response.json();
  if (!data.email || data.email_verified !== "true") {
    throw new Error("Google account email is not verified.");
  }
  return {
    name: data.name || data.email,
    email: data.email,
  };
}

async function verifyFacebookAccessToken(accessToken) {
  const response = await fetch(
    `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(
      String(accessToken || ""),
    )}`,
  );
  if (!response.ok) {
    throw new Error("Invalid Facebook token.");
  }
  const data = await response.json();
  if (!data.email) {
    throw new Error("Facebook account must provide an email.");
  }
  return {
    name: data.name || data.email,
    email: data.email,
  };
}

router.post(
  "/avatar-upload",
  avatarUpload.single("avatar"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "Avatar image is required." });
    }

    const avatarUrl = `/uploads/avatars/${path.basename(req.file.path)}`;
    res.status(201).json({ avatarUrl });
  }),
);

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const name = requireText(req.body.name, "Name");
    const email = requireEmail(req.body.email, "Email");
    const password = requireMinLength(String(req.body.password || ""), 8, "Password");
    const phone = asOptionalText(req.body.phone);
    const country = sanitizeCountry(req.body.country);
    const address = asOptionalText(req.body.address);
    const city = asOptionalText(req.body.city);
    const gender = sanitizeGender(req.body.gender);
    const birthDate = sanitizeBirthDate(req.body.birthDate);
    const avatarUrl = asOptionalText(req.body.avatarUrl);

    const existingEmail = db.users.find((entry) => String(entry.email || "").toLowerCase() === email.toLowerCase());
    if (existingEmail) {
      return res.status(409).json({ error: "Email is already registered." });
    }

    const username = uniqueUsername(db, normalizeUsernameCandidate(email));
    const user = {
      id: nanoid(),
      name,
      username,
      email,
      phone,
      country,
      address,
      city,
      gender,
      birthDate,
      avatarUrl,
      addresses: [],
      passwordHash: await bcrypt.hash(password, 10),
      role: "customer",
      authProvider: "local",
      isActive: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastLoginAt: nowIso(),
    };

    db.users.push(user);
    await saveDb();

    await addLog({
      action: "create",
      module: "customer-auth",
      user,
      details: `Customer registered (${email})`,
      ip: req.ip,
    });

    res.status(201).json(issueSession(user));
  }),
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const rawIdentifier = requireText(req.body.identifier ?? req.body.email, "Email or username");
    const password = String(req.body.password || "");
    const normalizedIdentifier = String(rawIdentifier).trim().toLowerCase();

    const existingUser = db.users.find(
      (entry) =>
        String(entry.email || "").toLowerCase() === normalizedIdentifier
        || String(entry.username || "").toLowerCase() === normalizedIdentifier,
    );

    const user = db.users.find(
      (entry) =>
        entry.role === "customer" &&
        (
          String(entry.email || "").toLowerCase() === normalizedIdentifier
          || String(entry.username || "").toLowerCase() === normalizedIdentifier
        ) &&
        entry.isActive,
    );
    if (!user) {
      if (existingUser && existingUser.role !== "customer") {
        return res.status(403).json({ error: "This account belongs to a staff user. Use the admin login page." });
      }
      if (existingUser && !existingUser.isActive) {
        return res.status(403).json({ error: "This account is disabled." });
      }
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const passwordCandidates = [...new Set([password, password.trim()].filter(Boolean))];
    let matches = false;

    for (const candidate of passwordCandidates) {
      if (user.passwordHash && await bcrypt.compare(candidate, user.passwordHash)) {
        matches = true;
        break;
      }
      if (typeof user.password === "string" && user.password === candidate) {
        matches = true;
        break;
      }
    }

    if (!matches) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    user.lastLoginAt = nowIso();
    user.updatedAt = nowIso();
    await saveDb();

    await addLog({
      action: "login",
      module: "customer-auth",
      user,
      details: `Customer login (${normalizedIdentifier})`,
      ip: req.ip,
    });

    res.json(issueSession(user));
  }),
);

router.post(
  "/social/google",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const profile = await verifyGoogleIdToken(req.body.idToken);
    const user = await upsertSocialCustomer(db, profile, "google");
    await saveDb();
    res.json(issueSession(user));
  }),
);

router.post(
  "/social/facebook",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const profile = await verifyFacebookAccessToken(req.body.accessToken);
    const user = await upsertSocialCustomer(db, profile, "facebook");
    await saveDb();
    res.json(issueSession(user));
  }),
);

router.get(
  "/google/start",
  asyncHandler(async (req, res) => {
    if (!env.googleClientId || !env.googleClientSecret) {
      return res.status(501).json({ error: "Google login is not configured on server." });
    }

    const redirectTo = asOptionalText(req.query.redirectTo) || `${env.storeBaseUrl}/store/auth/callback`;
    const state = Buffer.from(JSON.stringify({ redirectTo })).toString("base64url");
    const params = new URLSearchParams({
      client_id: env.googleClientId,
      redirect_uri: env.googleRedirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  }),
);

router.get(
  "/google/callback",
  asyncHandler(async (req, res) => {
    if (!env.googleClientId || !env.googleClientSecret) {
      return res.status(501).send("Google login is not configured.");
    }
    const code = asOptionalText(req.query.code);
    if (!code) {
      return res.status(400).send("Missing Google authorization code.");
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        redirect_uri: env.googleRedirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error("Google token exchange failed. Status:", tokenResponse.status, "Body:", errText);
      return res.status(400).send(`Google token exchange failed. Status: ${tokenResponse.status}, Error Details: ${errText}`);
    }

    const tokenData = await tokenResponse.json();
    const profile = await verifyGoogleIdToken(tokenData.id_token);

    const db = await getDb();
    const user = await upsertSocialCustomer(db, profile, "google");
    await saveDb();
    const session = issueSession(user);

    const statePayload = asOptionalText(req.query.state);
    let redirectTo = `${env.storeBaseUrl}/store/auth/callback`;
    try {
      if (statePayload) {
        const parsed = JSON.parse(Buffer.from(statePayload, "base64url").toString("utf-8"));
        if (parsed?.redirectTo) {
          redirectTo = String(parsed.redirectTo);
        }
      }
    } catch {
      // Ignore malformed state.
    }

    const url = new URL(redirectTo);
    url.searchParams.set("token", session.token);
    url.searchParams.set("csrfToken", session.csrfToken);
    url.searchParams.set("provider", "google");
    res.redirect(url.toString());
  }),
);

router.get(
  "/facebook/start",
  asyncHandler(async (req, res) => {
    if (!env.facebookAppId || !env.facebookAppSecret) {
      return res.status(501).json({ error: "Facebook login is not configured on server." });
    }

    const redirectTo = asOptionalText(req.query.redirectTo) || `${env.storeBaseUrl}/store/auth/callback`;
    const state = Buffer.from(JSON.stringify({ redirectTo })).toString("base64url");
    const params = new URLSearchParams({
      client_id: env.facebookAppId,
      redirect_uri: env.facebookRedirectUri,
      response_type: "code",
      scope: "email,public_profile",
      state,
    });
    res.redirect(`https://www.facebook.com/v23.0/dialog/oauth?${params.toString()}`);
  }),
);

router.get(
  "/facebook/callback",
  asyncHandler(async (req, res) => {
    if (!env.facebookAppId || !env.facebookAppSecret) {
      return res.status(501).send("Facebook login is not configured.");
    }
    const code = asOptionalText(req.query.code);
    if (!code) {
      return res.status(400).send("Missing Facebook authorization code.");
    }

    const tokenParams = new URLSearchParams({
      client_id: env.facebookAppId,
      client_secret: env.facebookAppSecret,
      redirect_uri: env.facebookRedirectUri,
      code,
    });
    const tokenResponse = await fetch(`https://graph.facebook.com/v23.0/oauth/access_token?${tokenParams}`);
    if (!tokenResponse.ok) {
      return res.status(400).send("Facebook token exchange failed.");
    }
    const tokenData = await tokenResponse.json();
    const profile = await verifyFacebookAccessToken(tokenData.access_token);

    const db = await getDb();
    const user = await upsertSocialCustomer(db, profile, "facebook");
    await saveDb();
    const session = issueSession(user);

    const statePayload = asOptionalText(req.query.state);
    let redirectTo = `${env.storeBaseUrl}/store/auth/callback`;
    try {
      if (statePayload) {
        const parsed = JSON.parse(Buffer.from(statePayload, "base64url").toString("utf-8"));
        if (parsed?.redirectTo) {
          redirectTo = String(parsed.redirectTo);
        }
      }
    } catch {
      // Ignore malformed state.
    }

    const url = new URL(redirectTo);
    url.searchParams.set("token", session.token);
    url.searchParams.set("csrfToken", session.csrfToken);
    url.searchParams.set("provider", "facebook");
    res.redirect(url.toString());
  }),
);

router.put(
  "/profile",
  authenticate,
  authorize("customer"),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const user = db.users.find((entry) => entry.id === req.user.id && entry.role === "customer" && entry.isActive);
    if (!user) {
      return res.status(404).json({ error: "Customer not found." });
    }

    if (req.body.email !== undefined) {
      const nextEmail = requireEmail(req.body.email, "Email");
      const emailOwner = db.users.find(
        (entry) => entry.id !== user.id && String(entry.email || "").toLowerCase() === nextEmail.toLowerCase(),
      );
      if (emailOwner) {
        return res.status(409).json({ error: "Email is already registered." });
      }
      user.email = nextEmail;
    }

    applyProfileFields(user, req.body || {});
    user.updatedAt = nowIso();
    await saveDb();

    res.json({ user: publicUser(user) });
  }),
);

router.put(
  "/password",
  authenticate,
  authorize("customer"),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const user = db.users.find((entry) => entry.id === req.user.id && entry.role === "customer" && entry.isActive);
    if (!user) {
      return res.status(404).json({ error: "Customer not found." });
    }

    const currentPassword = String(req.body.currentPassword || "");
    const newPassword = requireMinLength(String(req.body.newPassword || ""), 8, "New password");

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.updatedAt = nowIso();
    await saveDb();

    res.json({ success: true });
  }),
);

router.get(
  "/orders",
  authenticate,
  authorize("customer"),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const user = db.users.find((entry) => entry.id === req.user.id && entry.role === "customer");
    if (!user) {
      return res.status(404).json({ error: "Customer not found." });
    }

    const orders = (db.onlineOrders || [])
      .filter(
        (order) =>
          order.customerId === user.id
          || (user.email && String(order.customerEmail || "").toLowerCase() === String(user.email).toLowerCase()),
      )
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const stats = {
      active: orders.filter((order) => ["pending", "confirmed", "shipped"].includes(String(order.status || ""))).length,
      delivered: orders.filter((order) => String(order.status || "") === "delivered").length,
      cancelled: orders.filter((order) => String(order.status || "") === "cancelled").length,
      total: orders.length,
    };

    res.json({
      orders,
      stats,
    });
  }),
);

router.get(
  "/orders/:orderNumber",
  authenticate,
  authorize("customer"),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const user = db.users.find((entry) => entry.id === req.user.id && entry.role === "customer");
    if (!user) {
      return res.status(404).json({ error: "Customer not found." });
    }

    const order = (db.onlineOrders || []).find(
      (o) =>
        o.orderNumber === req.params.orderNumber &&
        (o.customerId === user.id || (user.email && String(o.customerEmail || "").toLowerCase() === String(user.email).toLowerCase()))
    );

    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    res.json({ order });
  })
);

router.get(
  "/me",
  authenticate,
  authorize("customer"),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const user = db.users.find((entry) => entry.id === req.user.id && entry.role === "customer");
    if (!user) {
      return res.status(404).json({ error: "Customer not found." });
    }
    res.json({ user: publicUser(user) });
  }),
);

export default router;
