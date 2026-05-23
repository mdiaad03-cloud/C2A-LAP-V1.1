import { nanoid } from "nanoid";
import { getDb, saveDb } from "../data/db.js";
import { nowIso } from "../utils/dateUtils.js";

export async function addLog({ action, module, user, details = "", ip = "" }) {
  const db = await getDb();
  db.logs.unshift({
    id: nanoid(),
    action,
    module,
    userId: user?.id || "system",
    username: user?.username || "system",
    details,
    ip,
    timestamp: nowIso(),
  });

  db.logs = db.logs.slice(0, 5000);
  await saveDb();
}
