import { sendSystemBackupEmail } from "./emailService.js";

export function scheduleAutomatedBackups() {
  console.log("Scheduling automated backups...");

  // Send an automated backup email at startup (after a 1-minute delay to ensure files/db are loaded)
  setTimeout(() => {
    console.log("Running startup automated backup...");
    sendSystemBackupEmail().catch((err) => {
      console.error("Startup automated backup failed:", err);
    });
  }, 60000);

  // Send an automated backup email every 24 hours (86,400,000 milliseconds)
  setInterval(() => {
    console.log("Running scheduled daily backup...");
    sendSystemBackupEmail().catch((err) => {
      console.error("Daily automated backup failed:", err);
    });
  }, 24 * 60 * 60 * 1000);
}
