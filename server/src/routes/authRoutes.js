import bcrypt from "bcryptjs";
import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/auth.js";
import { getDb, saveDb } from "../data/db.js";
import { createCsrfToken } from "../utils/csrf.js";
import { signAuthToken } from "../utils/jwt.js";
import { publicUser } from "../utils/userSanitize.js";
import { addLog } from "../services/logService.js";
import { sendLoginAlertEmail } from "../services/emailService.js";

const router = Router();

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    const db = await getDb();
    const user = db.users.find((entry) => entry.username.toLowerCase() === username.toLowerCase());

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const csrfToken = createCsrfToken();
    const token = signAuthToken({
      sub: user.id,
      role: user.role,
      csrf: csrfToken,
    });

    user.lastLoginAt = new Date().toISOString();
    await saveDb();

    await addLog({
      action: "login",
      module: "auth",
      user,
      details: `User ${user.username} logged in`,
      ip: req.ip,
    });

    try {
      await sendLoginAlertEmail({ user, ip: req.ip });
    } catch (mailErr) {
      console.error("Failed to send login alert email:", mailErr);
    }

    res.json({
      token,
      csrfToken,
      user: publicUser(user),
    });
  }),
);

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const user = db.users.find((entry) => entry.id === req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    res.json({ user: publicUser(user) });
  }),
);

export default router;
