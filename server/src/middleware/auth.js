import { getDb } from "../data/db.js";
import { verifyAuthToken } from "../utils/jwt.js";

async function resolveUserFromToken(token) {
  const decoded = verifyAuthToken(token);
  const db = await getDb();
  const user = db.users.find((entry) => entry.id === decoded.sub && entry.isActive);
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    email: user.email || "",
    phone: user.phone || "",
    address: user.address || "",
    city: user.city || "",
    gender: user.gender || "",
    birthDate: user.birthDate || "",
    avatarUrl: user.avatarUrl || "",
    csrfToken: decoded.csrf || "",
  };
}

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const sessionUser = await resolveUserFromToken(token);
    if (!sessionUser) {
      return res.status(401).json({ error: "Invalid user session." });
    }
    req.user = sessionUser;

    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

export async function authenticateOptional(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return next();
  }

  try {
    const sessionUser = await resolveUserFromToken(token);
    if (!sessionUser) {
      return res.status(401).json({ error: "Invalid user session." });
    }
    req.user = sessionUser;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required." });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission for this action." });
    }

    next();
  };
}

export function csrfProtect(req, res, next) {
  const method = req.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return next();
  }

  const csrfHeader = req.headers["x-csrf-token"];
  if (!req.user?.csrfToken || !csrfHeader || csrfHeader !== req.user.csrfToken) {
    return res.status(403).json({ error: "CSRF token mismatch." });
  }

  next();
}
