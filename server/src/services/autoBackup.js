import cron from "node-cron";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const archiver = require("archiver");

import { getRawDbPath } from "../data/db.js";
import { sendAdminAlertEmail } from "./emailService.js";
import { sendWhatsAppDocument } from "./whatsappService.js";
import { env } from "../config/env.js";

const UPLOADS_DIR = path.resolve("uploads");
const EXPORTS_DIR = path.resolve("exports");

export async function createBackupZip() {
  const dbPath = await getRawDbPath();
  const salesExcelPath = path.join(EXPORTS_DIR, "sales.xlsx");
  const backupFilename = `backup_c2alap_${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
  const backupPath = path.join(EXPORTS_DIR, backupFilename);

  return new Promise((resolve, reject) => {
    if (!fs.existsSync(EXPORTS_DIR)) {
      fs.mkdirSync(EXPORTS_DIR, { recursive: true });
    }

    const output = fs.createWriteStream(backupPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve(backupPath));
    archive.on("error", (err) => reject(err));

    archive.pipe(output);

    if (fs.existsSync(dbPath)) archive.file(dbPath, { name: "db.json" });
    if (fs.existsSync(salesExcelPath)) archive.file(salesExcelPath, { name: "sales.xlsx" });
    if (fs.existsSync(UPLOADS_DIR)) archive.directory(UPLOADS_DIR, "uploads");

    archive.finalize();
  });
}

export async function runAutoBackup() {
  try {
    console.log("Running scheduled auto-backup...");
    const backupPath = await createBackupZip();

    // 1. Send via Email
    const attachments = [{ path: backupPath }];
    await sendAdminAlertEmail({
      subject: "Daily System Backup",
      text: "Please find the daily system backup attached.",
      attachments,
    });

    // 2. Send via WhatsApp
    if (env.whatsappOwnerNumber) {
      await sendWhatsAppDocument({
        to: env.whatsappOwnerNumber,
        filePath: backupPath,
        fileName: path.basename(backupPath),
        caption: "📦 *Daily System Backup* for C2A LAP",
      });
    }

    // Clean up older backups (keep last 5)
    const files = fs.readdirSync(EXPORTS_DIR).filter(f => f.startsWith("backup_"));
    if (files.length > 5) {
      files.sort().slice(0, files.length - 5).forEach(file => {
        fs.unlinkSync(path.join(EXPORTS_DIR, file));
      });
    }
  } catch (error) {
    console.error("Auto Backup Failed:", error);
    await sendAdminAlertEmail({
      subject: "Backup Failed",
      text: `Daily backup failed: ${error.message}`,
    });
  }
}

export function startBackupCron() {
  // Run every day at 3:00 AM
  cron.schedule("0 3 * * *", () => {
    runAutoBackup();
  });
  console.log("Daily auto-backup scheduled at 3:00 AM.");
}
