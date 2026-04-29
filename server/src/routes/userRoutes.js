import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { Router } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate, authorize, csrfProtect } from "../middleware/auth.js";
import { getDb, saveDb } from "../data/db.js";
import { addLog } from "../services/logService.js";
import { nowIso } from "../utils/dateUtils.js";
import { publicUser } from "../utils/userSanitize.js";
import { asOptionalText, requireText, sanitizeRole } from "../utils/validation.js";

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

router.use(authenticate, authorize("admin"), csrfProtect);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    res.json({ users: db.users.map(publicUser) });
  }),
);

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
  "/",
  asyncHandler(async (req, res) => {
    const db = await getDb();

    const name = requireText(req.body.name, "Name");
    const username = requireText(req.body.username, "Username");
    const password = requireText(req.body.password, "Password");
    const role = sanitizeRole(req.body.role);
    const avatarUrl = asOptionalText(req.body.avatarUrl);

    const existing = db.users.find((entry) => entry.username.toLowerCase() === username.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: "Username already exists." });
    }

    const user = {
      id: nanoid(),
      name,
      username,
      avatarUrl,
      passwordHash: await bcrypt.hash(password, 10),
      role,
      isActive: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastLoginAt: null,
    };

    db.users.push(user);
    await saveDb();

    await addLog({
      action: "create",
      module: "users",
      user: req.user,
      details: `Created user ${username} (${role})`,
      ip: req.ip,
    });

    res.status(201).json({ user: publicUser(user) });
  }),
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const user = db.users.find((entry) => entry.id === req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    if (req.body.name !== undefined) {
      user.name = requireText(req.body.name, "Name");
    }

    if (req.body.role !== undefined) {
      user.role = sanitizeRole(req.body.role);
    }

    if (req.body.isActive !== undefined) {
      user.isActive = Boolean(req.body.isActive);
    }

    if (req.body.avatarUrl !== undefined) {
      user.avatarUrl = asOptionalText(req.body.avatarUrl);
    }

    if (req.body.password) {
      user.passwordHash = await bcrypt.hash(requireText(req.body.password, "Password"), 10);
    }

    user.updatedAt = nowIso();
    await saveDb();

    await addLog({
      action: "update",
      module: "users",
      user: req.user,
      details: `Updated user ${user.username}`,
      ip: req.ip,
    });

    res.json({ user: publicUser(user) });
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: "Admin cannot delete own account." });
    }

    const index = db.users.findIndex((entry) => entry.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: "User not found." });
    }

    const deleted = db.users[index];
    db.users.splice(index, 1);
    await saveDb();

    await addLog({
      action: "delete",
      module: "users",
      user: req.user,
      details: `Deleted user ${deleted.username}`,
      ip: req.ip,
    });

    res.json({ success: true });
  }),
);

export default router;
