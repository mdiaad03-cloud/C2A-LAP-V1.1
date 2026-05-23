function parseNumber(value, defaultValue = 0) {
  if (value === null || value === undefined || value === "") {
    return defaultValue;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  let raw = String(value).trim();
  if (!raw) {
    return defaultValue;
  }

  const arabicPersianMap = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
    '٬': ',', '٫': '.' // Arabic thousands and decimal separators
  };

  for (const [key, val] of Object.entries(arabicPersianMap)) {
    raw = raw.replaceAll(key, val);
  }

  raw = raw.replace(/[^\d,.\-]/g, "");
  // Trim leading/trailing dots or commas
  raw = raw.replace(/^[.,]+|[.,]+$/g, "");

  if (!raw) {
    return defaultValue;
  }

  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");

  if (hasComma && hasDot) {
    const lastComma = raw.lastIndexOf(",");
    const lastDot = raw.lastIndexOf(".");
    if (lastComma > lastDot) {
      raw = raw.replace(/\./g, "").replace(/,/g, ".");
    } else {
      raw = raw.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    const parts = raw.split(",");
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      raw = raw.replace(/,/g, "");
    } else {
      raw = raw.replace(/,/g, ".");
    }
  } else if (!hasComma && hasDot) {
    const parts = raw.split(".");
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      raw = raw.replace(/\./g, "");
    }
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

console.log("Parsed '١٢,٥٠٠':", parseNumber("١٢,٥٠٠"));
console.log("Parsed '١٢.٥':", parseNumber("١٢.٥"));
console.log("Parsed '12,500.50 ج.م':", parseNumber("12,500.50 ج.م"));
console.log("Parsed '١٬٢٥٠':", parseNumber("١٬٢٥٠"));
console.log("Parsed '12.500.000':", parseNumber("12.500.000"));
console.log("Parsed '12,500,000':", parseNumber("12,500,000"));
