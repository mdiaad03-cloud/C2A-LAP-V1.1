export function requireText(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required.`);
  }
  return sanitizeText(value);
}

export function asOptionalText(value) {
  if (value === undefined || value === null) {
    return "";
  }
  return sanitizeText(String(value));
}

export function requirePositiveNumber(value, field) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${field} must be a valid number.`);
  }
  return parsed;
}

export function requirePositiveInteger(value, field) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${field} must be a positive integer.`);
  }
  return parsed;
}

export function sanitizeRole(value) {
  const role = String(value || "").toLowerCase();
  if (!["admin", "sales", "customer", "products"].includes(role)) {
    throw new Error("Role must be admin, sales, products, or customer.");
  }
  return role;
}

export function sanitizeText(value) {
  return String(value || "")
    .trim()
    .replace(/[<>]/g, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, 2000);
}

export function requireEmail(value, field = "Email") {
  const email = sanitizeText(value).toLowerCase();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!valid) {
    throw new Error(`${field} is invalid.`);
  }
  return email;
}

export function requireMinLength(value, minLength, field) {
  const text = String(value || "");
  if (text.length < minLength) {
    throw new Error(`${field} must be at least ${minLength} characters.`);
  }
  return text;
}

const ALLOWED_COUNTRIES = new Set(["", "EG", "SA", "AE", "QA", "KW", "BH", "OM"]);

export function sanitizeCountry(value, field = "Country") {
  const normalized = sanitizeText(value).toUpperCase();
  if (!ALLOWED_COUNTRIES.has(normalized)) {
    throw new Error(`${field} is invalid.`);
  }
  return normalized;
}
