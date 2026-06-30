import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import xlsx from "xlsx";
import { nanoid } from "nanoid";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate, authorize, csrfProtect } from "../middleware/auth.js";
import { getDb, saveDb } from "../data/db.js";
import { addLog } from "../services/logService.js";
import { nowIso } from "../utils/dateUtils.js";
import { asOptionalText, requireText } from "../utils/validation.js";
import {
  buildAgentProductDraft,
  buildAgentShippingDraft,
  buildAgentSupportReply,
} from "../services/operationsAgentService.js";
import { fetchProductImages } from "../utils/imageFetcher.js";

const router = Router();

router.use(authenticate, csrfProtect, authorize("admin"));

const importUploadDir = path.resolve("uploads", "agent-imports");
if (!fs.existsSync(importUploadDir)) {
  fs.mkdirSync(importUploadDir, { recursive: true });
}

const excelUpload = multer({
  dest: importUploadDir,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, callback) => {
    if (file.originalname.endsWith(".xlsx") || file.originalname.endsWith(".xls")) {
      callback(null, true);
      return;
    }

    callback(new Error("Only Excel files are allowed."));
  },
});

const FIELD_ALIASES = {
  brand: ["brand", "Brand", "company", "Company", "الشركة", "الماركة", "البراند", "البرند", "براند", "شركة", "ماركة"],
  model: ["model", "Model", "laptopName", "LaptopName", "name", "Name", "الاسم", "الجهاز", "الموديل", "اسم الجهاز", "النوع", "نوع الجهاز", "اسم اللاب", "اللاب"],
  modelAr: ["modelAr", "ModelAr", "laptopNameAr", "LaptopNameAr", "nameAr", "NameAr", "الاسم بالعربي", "الموديل بالعربي", "اسم الجهاز بالعربي"],
  category: ["category", "Category", "type", "Type", "الفئة", "التصنيف", "القسم"],
  categoryAr: ["categoryAr", "CategoryAr", "typeAr", "TypeAr", "الفئة بالعربي", "التصنيف بالعربي"],
  ram: ["ram", "RAM", "memory", "Memory", "الرام", "الرامات", "الذاكرة", "ذاكرة", "رام"],
  storage: ["storage", "Storage", "ssd", "SSD", "hdd", "HDD", "disk", "Disk", "SSD/HDD", "ssd/hdd", "ssdhdd", "ssd / hdd", "HDD/SSD", "hdd/ssd", "hddssd", "hdd / ssd", "hard", "Hard", "harddisk", "HardDisk", "hard disk", "Hard Disk", "hard_disk", "hard-disk", "rom", "ROM", "capacity", "Capacity", "المساحة", "الهارد", "التخزين", "مساحة التخزين", "سعة التخزين", "هارد", "مساحه", "المساحه", "مساحة", "السعة", "سعة"],
  cpu: ["cpu", "CPU", "processor", "Processor", "البروسيسور", "المعالج", "بروسيسور", "معالج"],
  cpuAr: ["cpuAr", "CPUAr", "processorAr", "ProcessorAr", "المعالج بالعربي"],
  gpu: ["gpu", "GPU", "graphics", "Graphics", "كارت الشاشة", "الفيجا", "كارت شاشة", "فيجا"],
  gpuAr: ["gpuAr", "GPUAr", "graphicsAr", "GraphicsAr", "كارت الشاشة بالعربي"],
  display: ["display", "Display", "screen", "Screen", "size", "Size", "screen size", "Screen Size", "الشاشة", "شاشة", "المقاس", "مقاس الشاشة"],
  displayAr: ["displayAr", "DisplayAr", "screenAr", "ScreenAr", "الشاشة بالعربي"],
  os: ["os", "OS", "نظام التشغيل", "النظام", "النسخة", "نظام تشغيل"],
  osAr: ["osAr", "OSAr", "نظام التشغيل بالعربي"],
  weight: ["weight", "Weight", "الوزن", "وزن"],
  weightAr: ["weightAr", "WeightAr", "الوزن بالعربي"],
  battery: ["battery", "Battery", "البطارية", "بطارية"],
  batteryAr: ["batteryAr", "BatteryAr", "البطارية بالعربي"],
  purchasePrice: ["purchasePrice", "PurchasePrice", "cost", "Cost", "costPrice", "CostPrice", "PriceDealer", "priceDealer", "DealerPrice", "dealerPrice", "price dealer", "dealer price", "PriceDelar", "priceDelar", "DelarPrice", "delarPrice", "price delar", "delar price", "delar", "delarprice", "سعر الشراء", "التكلفة", "سعر شراء", "تكلفة", "شراء", "سعر الجملة", "سعر جملة", "الجملة", "جملة", "سعرالتكلفة", "سعر التكلفة", "سعر ديلر", "سعر الديلر", "ديلر"],
  sellingPrice: ["sellingPrice", "SellingPrice", "price", "Price", "salePrice", "SalePrice", "سعر البيع", "السعر", "سعر بيع", "سعر", "سعرالبيع", "سعرالبيعالمقترح"],
  stock: ["stock", "Stock", "qty", "Qty", "quantity", "Quantity", "المخزون", "الكمية", "العدد", "كمية", "عدد", "مخزون"],
  warrantyMonths: ["warrantyMonths", "WarrantyMonths", "warranty", "Warranty", "الضمان", "ضمان", "مدة الضمان", "فترة الضمان"],
  discountPercent: ["discountPercent", "DiscountPercent", "discount", "Discount", "الخصم", "خصم", "نسبة الخصم"],
  imageUrls: ["imageUrls", "ImageUrls", "images", "Images", "image", "Image", "الصور", "صور", "رابط الصور", "رابط الصورة"],
  shippingInfo: ["shippingInfo", "ShippingInfo", "shipping", "Shipping", "الشحن", "شحن"],
  shippingInfoAr: ["shippingInfoAr", "ShippingInfoAr", "الشحن بالعربي"],
  featured: ["featured", "Featured", "مميز", "متميز"],
  bestOffer: ["bestOffer", "BestOffer", "offer", "Offer", "عرض خاص", "عرض"],
  sku: ["sku", "SKU", "code", "Code", "الكود", "كود", "sku"],
};

function buildSuccess(message, extra = {}) {
  return { success: true, message, ...extra };
}

function buildFailure(message, extra = {}) {
  return { success: false, message, error: message, ...extra };
}

function getAgentSettings(db) {
  return db.storeSettings?.agentSettings || {};
}

function normalizeHeaderKey(key) {
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-./]+/g, "")
    .replace(/[()[\]{}]/g, "");
}

function normalizeRowKeys(row) {
  const normalized = {};
  for (const [key, value] of Object.entries(row || {})) {
    const normalizedKey = normalizeHeaderKey(key);
    if (normalizedKey) {
      normalized[normalizedKey] = value;
    }
  }
  return normalized;
}

function getValueByAliases(row, aliases) {
  for (const alias of aliases) {
    const key = normalizeHeaderKey(alias);
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
}

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
    '٬': ',', '٫': '.'
  };

  for (const [key, val] of Object.entries(arabicPersianMap)) {
    raw = raw.replaceAll(key, val);
  }

  raw = raw.replace(/[^\d,.\-]/g, "");
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

function parseBooleanish(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function createProductFromDraft(draft) {
  const product = {
    id: nanoid(),
    sku: asOptionalText(draft.sku) || `SKU-${Date.now()}`,
    laptopName: requireText(draft.laptopName, "Laptop name"),
    laptopNameAr: asOptionalText(draft.laptopNameAr),
    brand: requireText(draft.brand, "Brand"),
    category: asOptionalText(draft.category),
    categoryAr: asOptionalText(draft.categoryAr),
    ram: asOptionalText(draft.ram) || "N/A",
    storage: asOptionalText(draft.storage) || "N/A",
    purchasePrice: Number(parseNumber(draft.purchasePrice, 0).toFixed(2)),
    sellingPrice: Number(parseNumber(draft.sellingPrice, 0).toFixed(2)),
    price: Number(parseNumber(draft.sellingPrice, 0).toFixed(2)),
    stock: Math.max(0, Number.parseInt(draft.stock, 10) || 0),
    warrantyMonths: Math.max(1, Number.parseInt(draft.warrantyMonths, 10) || 3),
    discountPercent: Math.max(0, Number(parseNumber(draft.discountPercent, 0).toFixed(2))),
    description: asOptionalText(draft.description),
    descriptionAr: asOptionalText(draft.descriptionAr),
    imageUrls: String(draft.imageUrls || "")
      .split(/[,;\n]/g)
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 8),
    shippingInfo: asOptionalText(draft.shippingInfo),
    shippingInfoAr: asOptionalText(draft.shippingInfoAr),
    featured: parseBooleanish(draft.featured),
    bestOffer: parseBooleanish(draft.bestOffer),
    specs: {
      cpu: asOptionalText(draft.cpu),
      gpu: asOptionalText(draft.gpu),
      display: asOptionalText(draft.display),
      os: asOptionalText(draft.os),
      weight: asOptionalText(draft.weight),
      battery: asOptionalText(draft.battery),
    },
    specsAr: {
      cpu: asOptionalText(draft.cpuAr || draft.cpu),
      gpu: asOptionalText(draft.gpuAr || draft.gpu),
      display: asOptionalText(draft.displayAr || draft.display),
      os: asOptionalText(draft.osAr || draft.os),
      weight: asOptionalText(draft.weightAr || draft.weight),
      battery: asOptionalText(draft.batteryAr || draft.battery),
    },
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  return product;
}

function rowToAgentInput(row) {
  const normalizedRow = normalizeRowKeys(row);
  const input = {};

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    input[field] = getValueByAliases(normalizedRow, aliases);
  }

  return input;
}

router.post(
  "/products/draft",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const settings = getAgentSettings(db);
    if (settings.productDraftEnabled === false) {
      return res.status(403).json(buildFailure("Product agent is disabled in settings."));
    }

    const draft = buildAgentProductDraft(req.body || {}, settings);
    if (!draft.imageUrls || draft.imageUrls.trim() === "") {
      try {
        let query = draft.laptopName;
        if (draft.brand && !query.toLowerCase().startsWith(draft.brand.toLowerCase())) {
          query = `${draft.brand} ${query}`;
        }
        const fetched = await fetchProductImages(query);
        draft.imageUrls = [fetched.thumbnail, ...fetched.gallery].filter(Boolean).join(",");
      } catch (err) {
        console.error("Auto image fetch failed during draft generation:", err);
      }
    }
    res.json(buildSuccess("Product draft generated successfully.", { draft }));
  }),
);

router.post(
  "/products/import-excel",
  excelUpload.single("file"),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const settings = getAgentSettings(db);
    if (settings.productDraftEnabled === false || settings.excelImportEnabled === false) {
      return res.status(403).json(buildFailure("Excel import agent is disabled in settings."));
    }

    if (!req.file) {
      return res.status(400).json(buildFailure("Excel file is required."));
    }

    const workbook = xlsx.readFile(req.file.path);
    let rows = [];
    for (const sheetName of workbook.SheetNames) {
      const candidateRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
      if (candidateRows.length > 0) {
        rows = candidateRows;
        break;
      }
    }

    if (rows.length === 0) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json(buildFailure("No rows found in Excel file."));
    }

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
      try {
        const input = rowToAgentInput(row);
        if (!String(input.brand || "").trim() && !String(input.model || "").trim()) {
          skippedCount += 1;
          continue;
        }

        const draft = buildAgentProductDraft(input, settings);
        
        // Skip incomplete draft products that lack laptopName or brand
        if (!draft.laptopName || !draft.brand) {
          skippedCount += 1;
          continue;
        }

        if (!draft.imageUrls || draft.imageUrls.trim() === "") {
          try {
            let query = draft.laptopName;
            if (draft.brand && !query.toLowerCase().startsWith(draft.brand.toLowerCase())) {
              query = `${draft.brand} ${query}`;
            }
            const fetched = await fetchProductImages(query);
            draft.imageUrls = [fetched.thumbnail, ...fetched.gallery].filter(Boolean).join(",");
          } catch (err) {
            console.error("Auto image fetch failed during Excel import:", err);
          }
        }

        const existing = db.products.find((entry) => String(entry.sku || "").toLowerCase() === String(draft.sku || "").toLowerCase());
        if (existing) {
          const updatedProduct = createProductFromDraft({ ...existing, ...draft, id: existing.id, createdAt: existing.createdAt });
          Object.assign(existing, {
            ...updatedProduct,
            id: existing.id,
            createdAt: existing.createdAt,
            updatedAt: nowIso(),
          });
          updatedCount += 1;
        } else {
          db.products.push(createProductFromDraft(draft));
          importedCount += 1;
        }
      } catch (rowError) {
        console.error("Failed to process Excel row via agent:", rowError, row);
        skippedCount += 1;
      }
    }

    await saveDb();
    fs.unlink(req.file.path, () => {});

    await addLog({
      action: "upload",
      module: "agent",
      user: req.user,
      details: `Agent imported products from Excel: added=${importedCount}, updated=${updatedCount}, skipped=${skippedCount}`,
      ip: req.ip,
    });

    res.status(201).json(buildSuccess("Excel products processed successfully.", {
      importedCount,
      updatedCount,
      skippedCount,
    }));
  }),
);

router.post(
  "/support/tickets/:id/reply-draft",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const settings = getAgentSettings(db);
    if (settings.supportReplyEnabled === false) {
      return res.status(403).json(buildFailure("Support agent is disabled in settings."));
    }

    const ticket = db.supportTickets.find((entry) => entry.id === req.params.id);
    if (!ticket) {
      return res.status(404).json(buildFailure("Ticket not found."));
    }

    const linkedOrder = ticket.orderNumber
      ? db.onlineOrders.find((entry) => entry.orderNumber === ticket.orderNumber)
      : null;

    const suggestion = buildAgentSupportReply({ ticket, linkedOrder, settings });
    res.json(buildSuccess("Reply draft generated successfully.", { suggestion }));
  }),
);

router.post(
  "/support/tickets/:id/auto-reply",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const settings = getAgentSettings(db);
    if (settings.supportReplyEnabled === false) {
      return res.status(403).json(buildFailure("Support agent is disabled in settings."));
    }

    const ticket = db.supportTickets.find((entry) => entry.id === req.params.id);
    if (!ticket) {
      return res.status(404).json(buildFailure("Ticket not found."));
    }

    const linkedOrder = ticket.orderNumber
      ? db.onlineOrders.find((entry) => entry.orderNumber === ticket.orderNumber)
      : null;
    const suggestion = buildAgentSupportReply({ ticket, linkedOrder, settings });
    const body = requireText(req.body.message || suggestion.reply, "Reply");

    ticket.messages.unshift({
      id: nanoid(),
      senderRole: "admin",
      senderName: req.user.name,
      body,
      createdAt: nowIso(),
    });
    ticket.lastReplyAt = nowIso();
    ticket.updatedAt = nowIso();
    if (settings.autoMoveTicketsToInProgress && ticket.status === "open") {
      ticket.status = "in_progress";
    }

    await saveDb();

    await addLog({
      action: "reply",
      module: "agent",
      user: req.user,
      details: `Agent replied to support ticket ${ticket.id}`,
      ip: req.ip,
    });

    res.status(201).json(buildSuccess("Automatic reply sent successfully.", {
      ticket,
      suggestion,
    }));
  }),
);

router.post(
  "/orders/:id/shipping-draft",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const settings = getAgentSettings(db);
    if (settings.shippingAgentEnabled === false) {
      return res.status(403).json(buildFailure("Shipping agent is disabled in settings."));
    }

    const order = db.onlineOrders.find((entry) => entry.id === req.params.id);
    if (!order) {
      return res.status(404).json(buildFailure("Online order not found."));
    }

    const draft = buildAgentShippingDraft(order, settings);
    res.json(buildSuccess("Shipping draft generated successfully.", { draft }));
  }),
);

export default router;
