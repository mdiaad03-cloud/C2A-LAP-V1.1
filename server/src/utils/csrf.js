import crypto from "node:crypto";

export function createCsrfToken() {
  return crypto.randomBytes(24).toString("hex");
}
