import fs from "node:fs/promises";
import path from "node:path";

async function printSampleLog() {
  const dbPath = path.resolve("src/data/db.json");
  try {
    const dataRaw = await fs.readFile(dbPath, "utf8");
    const db = JSON.parse(dataRaw);
    
    // Find an update log
    const log = (db.logs || []).find(l => String(l.details || "").includes("Updated product"));
    if (log) {
      console.log(JSON.stringify(log, null, 2));
    } else {
      console.log("No update logs found.");
    }
  } catch (err) {
    console.error(err);
  }
}

printSampleLog();
