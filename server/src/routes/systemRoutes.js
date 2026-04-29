import fs from "node:fs/promises";
import { Router } from "express";
import { nanoid } from "nanoid";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate, authorize, csrfProtect } from "../middleware/auth.js";
import { getDb, getRawDbPath, saveDb } from "../data/db.js";
import { addLog } from "../services/logService.js";
import { getSalesWorkbookPath } from "../services/excelAutoSaveService.js";
import { nowIso } from "../utils/dateUtils.js";
import { requireText } from "../utils/validation.js";

const router = Router();

router.get(
  "/health",
  asyncHandler(async (req, res) => {
    res.json({ status: "ok", timestamp: nowIso(), service: "C2A LAP API" });
  }),
);

router.use(authenticate, csrfProtect);

router.get(
  "/backup",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const dbPath = await getRawDbPath();
    const file = await fs.readFile(dbPath, "utf-8");

    await addLog({
      action: "download",
      module: "backup",
      user: req.user,
      details: "Downloaded JSON backup",
      ip: req.ip,
    });

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="c2a-backup-${Date.now()}.json"`,
    );
    res.send(file);
  }),
);

router.get(
  "/sales-excel",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const filePath = getSalesWorkbookPath();

    await addLog({
      action: "download",
      module: "sales",
      user: req.user,
      details: "Downloaded auto-synced sales Excel",
      ip: req.ip,
    });

    res.download(filePath, "sales_autosave.xlsx");
  }),
);

router.get(
  "/notifications",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const notifications = db.notifications.slice(0, 50);
    res.json({ notifications });
  }),
);

router.post(
  "/notifications",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const db = await getDb();

    const notification = {
      id: nanoid(),
      title: requireText(req.body.title, "Title"),
      message: requireText(req.body.message, "Message"),
      createdAt: nowIso(),
      createdBy: req.user.id,
      createdByName: req.user.name,
    };

    db.notifications.unshift(notification);
    db.notifications = db.notifications.slice(0, 200);
    await saveDb();

    await addLog({
      action: "create",
      module: "notifications",
      user: req.user,
      details: `Created notification: ${notification.title}`,
      ip: req.ip,
    });

    res.status(201).json({ notification });
  }),
);

export default router;
