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
import { fetchProductImages } from "../utils/imageFetcher.js";
import { sendProductAddedEmail } from "../services/emailService.js";
import { autoDetectBrand } from "../services/operationsAgentService.js";

const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const productImageDir = path.join(uploadDir, "products");
if (!fs.existsSync(productImageDir)) {
  fs.mkdirSync(productImageDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
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

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, productImageDir),
    filename: (req, file, cb) => {
      const extension = path.extname(file.originalname || "").toLowerCase();
      const safeExtension = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extension)
        ? extension
        : ".jpg";
      cb(null, `${Date.now()}-${nanoid(8)}${safeExtension}`);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 8,
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

const router = Router();

router.use(authenticate, csrfProtect);

const FIELD_ALIASES = {
  laptopName: [
    "LaptopName", "laptopName", "Model", "model", "Name", "name", "Product", "product",
    "الاسم", "الجهاز", "الموديل", "اسم الجهاز", "النوع", "نوع الجهاز", "اسم اللاب", "اللاب"
  ],
  brand: [
    "Brand", "brand", "Company", "company", "Manufacturer", "manufacturer",
    "الشركة", "الماركة", "البراند", "البرند", "براند", "شركة", "ماركة"
  ],
  ram: [
    "RAM", "ram", "Memory", "memory", "Mem", "mem",
    "الرام", "الرامات", "الذاكرة", "ذاكرة", "رام"
  ],
  storage: [
    "Storage", "storage", "SSD", "ssd", "HDD", "hdd", "Disk", "disk", "SSD/HDD", "ssd/hdd", "ssdhdd", "ssd / hdd",
    "hard", "Hard", "harddisk", "HardDisk", "hard disk", "Hard Disk", "hard_disk", "hard-disk", "rom", "ROM", "capacity", "Capacity",
    "المساحة", "الهارد", "التخزين", "مساحة التخزين", "سعة التخزين", "هارد", "مساحه", "المساحه", "مساحة", "السعة", "سعة"
  ],
  purchasePrice: [
    "PurchasePrice", "purchasePrice", "BuyPrice", "buyPrice", "Cost", "cost", "CostPrice", "costPrice",
    "PriceDealer", "priceDealer", "DealerPrice", "dealerPrice", "price dealer", "dealer price",
    "PriceDelar", "priceDelar", "DelarPrice", "delarPrice", "price delar", "delar price", "delar", "delarprice",
    "سعر الشراء", "التكلفة", "سعر شراء", "تكلفة", "شراء", "سعر الجملة", "سعر جملة", "الجملة", "جملة", "سعرالتكلفة", "سعر التكلفة", "سعر ديلر", "سعر الديلر", "ديلر"
  ],
  sellingPrice: [
    "SellingPrice", "sellingPrice", "SalePrice", "salePrice", "SellPrice", "sellPrice", "Price", "price",
    "سعر البيع", "السعر", "سعر بيع", "سعر", "سعرالبيع", "سعرالبيعالمقترح", "سعر القطاعي", "سعر قطاعي", "القطاعي", "قطاعي", "سعرالمستهلك", "سعر المستهلك"
  ],
  stock: [
    "Stock", "stock", "Qty", "qty", "Quantity", "quantity",
    "المخزون", "الكمية", "العدد", "كمية", "عدد", "مخزون"
  ],
  warrantyMonths: [
    "WarrantyMonths", "warrantyMonths", "Warranty", "warranty",
    "الضمان", "ضمان", "مدة الضمان", "فترة الضمان"
  ],
  sku: [
    "SKU", "sku", "Code", "code", "ModelCode", "modelCode", "ProductCode", "productCode",
    "الكود", "كود", "sku"
  ],
  discountPercent: [
    "DiscountPercent", "discountPercent", "Discount", "discount",
    "الخصم", "خصم", "نسبة الخصم"
  ],
  description: [
    "Description", "description", "Details", "details",
    "الوصف", "التفاصيل"
  ],
  imageUrls: [
    "ImageUrls", "imageUrls", "Images", "images", "Image", "image",
    "الصور", "صور", "رابط الصور", "رابط الصورة"
  ],
  shippingInfo: [
    "ShippingInfo", "shippingInfo", "Shipping", "shipping",
    "الشحن", "شحن"
  ],
  featured: [
    "Featured", "featured",
    "مميز", "متميز"
  ],
  bestOffer: [
    "BestOffer", "bestOffer", "Offer", "offer",
    "عرض خاص", "عرض"
  ],
  category: [
    "Category", "category", "Type", "type", "Segment", "segment",
    "الفئة", "التصنيف", "القسم"
  ],
};

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
      // 1.234,56 -> 1234.56
      raw = raw.replace(/\./g, "").replace(/,/g, ".");
    } else {
      // 1,234.56 -> 1234.56
      raw = raw.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    const parts = raw.split(",");
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      // 1,200 or 1,200,000 -> 1200 / 1200000
      raw = raw.replace(/,/g, "");
    } else {
      // 12,5 -> 12.5
      raw = raw.replace(/,/g, ".");
    }
  } else if (!hasComma && hasDot) {
    const parts = raw.split(".");
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      // 1.200 or 1.200.000 -> 1200 / 1200000
      raw = raw.replace(/\./g, "");
    }
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function parseBooleanish(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const text = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(text)) {
    return true;
  }
  if (["0", "false", "no", "n"].includes(text)) {
    return false;
  }
  return defaultValue;
}

function parseImageUrls(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 8);
  }
  if (typeof value === "string") {
    return value
      .split(/[,;\n]/g)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8);
  }
  return [];
}

function normalizeRam(value) {
  const text = asOptionalText(value);
  if (!text) {
    return "N/A";
  }

  if (/[a-zA-Z]/.test(text)) {
    return text.toUpperCase();
  }

  const parsed = parseNumber(text, 0);
  if (!parsed) {
    return text;
  }

  if (parsed >= 1024 && parsed % 1024 === 0) {
    return `${parsed / 1024}GB`;
  }

  return `${parsed}GB`;
}

function normalizeStorage(value) {
  const text = asOptionalText(value);
  if (!text) {
    return "N/A";
  }

  const clean = text.trim().toLowerCase();

  // Handle strings like "256.m.2", "512 m.2", "256 ssd", "1tb hdd"
  const match = clean.match(/^(\d+)\s*(gb|tb|g|t|mb|m\.2|ssd|hdd|nvme|m2)?/);
  if (match) {
    const num = parseInt(match[1], 10);
    const unit = match[2];
    
    let unitStr = "GB";
    if (unit) {
      if (unit.startsWith("t")) {
        unitStr = "TB";
      } else if (unit.startsWith("m") && !unit.includes("m.2") && !unit.includes("m2")) {
        unitStr = "MB";
      }
    } else {
      if (num <= 4) {
        unitStr = "TB";
      }
    }
    
    let typeStr = "";
    if (clean.includes("ssd") || clean.includes("m.2") || clean.includes("m2") || clean.includes("nvme")) {
      typeStr = " SSD";
    } else if (clean.includes("hdd")) {
      typeStr = " HDD";
    }
    
    return `${num}${unitStr}${typeStr}`;
  }

  if (/[a-zA-Z]/.test(text)) {
    return text.toUpperCase();
  }

  const parsed = parseNumber(text, 0);
  if (!parsed) {
    return text;
  }

  if (parsed >= 1024 && parsed % 1024 === 0) {
    return `${parsed / 1024}TB`;
  }

  return `${parsed}GB`;
}

function generateSku(brand, laptopName, index) {
  const base = `${brand || "LAP"}-${laptopName || "MODEL"}`
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 28);
  return `SKU-${base || "ITEM"}-${index + 1}`;
}

function resolveSellingPrice(source) {
  return Number(
    parseNumber(source?.sellingPrice ?? source?.price ?? source?.salePrice, 0).toFixed(2),
  );
}

function resolvePurchasePrice(source) {
  return Number(
    parseNumber(source?.purchasePrice ?? source?.costPrice ?? source?.cost, 0).toFixed(2),
  );
}

function withProductPricingCompatibility(product) {
  const sellingPrice = resolveSellingPrice(product);
  const purchasePrice = resolvePurchasePrice(product);
  return {
    ...product,
    sellingPrice,
    purchasePrice,
    price: sellingPrice,
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const query = String(req.query.query || "").trim().toLowerCase();

    const products = db.products
      .filter((product) => {
        if (!query) {
          return true;
        }

        return [
          product.sku,
          product.laptopName,
          product.laptopNameAr,
          product.brand,
          product.ram,
          product.storage,
          product.category,
          product.categoryAr,
          product.description,
          product.descriptionAr,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .slice(0, 300)
      .map(withProductPricingCompatibility);

    if (req.user.role === "sales") {
      return res.json({
        products: products.map((product) => ({
          id: product.id,
          sku: product.sku,
          laptopName: product.laptopName,
          brand: product.brand,
          category: product.category || "",
          ram: product.ram,
          storage: product.storage,
          sellingPrice: product.sellingPrice,
          stock: product.stock,
          warrantyMonths: product.warrantyMonths,
          createdAt: product.createdAt,
        })),
      });
    }

    res.json({ products });
  }),
);

router.post(
  "/",
  authorize("admin", "products"),
  asyncHandler(async (req, res) => {
    const db = await getDb();

    const product = {
      id: nanoid(),
      sku: asOptionalText(req.body.sku) || `SKU-${Date.now()}`,
      laptopName: requireText(req.body.laptopName, "Laptop name"),
      laptopNameAr: asOptionalText(req.body.laptopNameAr),
      brand: requireText(req.body.brand, "Brand"),
      category: asOptionalText(req.body.category),
      categoryAr: asOptionalText(req.body.categoryAr),
      ram: normalizeRam(requireText(req.body.ram, "RAM")),
      storage: normalizeStorage(requireText(req.body.storage, "Storage")),
      purchasePrice: resolvePurchasePrice(req.body),
      sellingPrice: resolveSellingPrice(req.body),
      stock: Math.max(0, Math.trunc(parseNumber(req.body.stock, 0))),
      warrantyMonths: Math.max(1, Math.trunc(parseNumber(req.body.warrantyMonths, 12)) || 12),
      discountPercent: Math.max(0, Math.min(90, Number(parseNumber(req.body.discountPercent, 0).toFixed(2)))),
      description: asOptionalText(req.body.description),
      descriptionAr: asOptionalText(req.body.descriptionAr),
      imageUrls: parseImageUrls(req.body.imageUrls),
      shippingInfo: asOptionalText(req.body.shippingInfo),
      shippingInfoAr: asOptionalText(req.body.shippingInfoAr),
      featured: parseBooleanish(req.body.featured),
      bestOffer: parseBooleanish(req.body.bestOffer),
      specs: {
        cpu: asOptionalText(req.body.specs?.cpu || req.body.cpu),
        gpu: asOptionalText(req.body.specs?.gpu || req.body.gpu),
        display: asOptionalText(req.body.specs?.display || req.body.display),
        os: asOptionalText(req.body.specs?.os || req.body.os),
        weight: asOptionalText(req.body.specs?.weight || req.body.weight),
        battery: asOptionalText(req.body.specs?.battery || req.body.battery),
      },
      specsAr: {
        cpu: asOptionalText(req.body.specsAr?.cpu || req.body.cpuAr),
        gpu: asOptionalText(req.body.specsAr?.gpu || req.body.gpuAr),
        display: asOptionalText(req.body.specsAr?.display || req.body.displayAr),
        os: asOptionalText(req.body.specsAr?.os || req.body.osAr),
        weight: asOptionalText(req.body.specsAr?.weight || req.body.weightAr),
        battery: asOptionalText(req.body.specsAr?.battery || req.body.batteryAr),
      },
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    product.price = product.sellingPrice;

    if (!product.imageUrls || product.imageUrls.length === 0) {
      try {
        const fetched = await fetchProductImages(`${product.brand} ${product.laptopName}`);
        product.imageUrls = [fetched.thumbnail, ...fetched.gallery].filter(Boolean);
      } catch (err) {
        console.error("Auto image fetch failed during manual product creation:", err);
      }
    }

    db.products.push(product);
    await saveDb();

    try {
      await sendProductAddedEmail({ product });
    } catch (mailErr) {
      console.error("Failed to send product added email:", mailErr);
    }

    await addLog({
      action: "create",
      module: "products",
      user: req.user,
      details: `Added product ${product.laptopName}`,
      ip: req.ip,
    });

    res.status(201).json({ product });
  }),
);

router.put(
  "/:id",
  authorize("admin", "products"),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const product = db.products.find((entry) => entry.id === req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found." });
    }

    if (req.body.sku !== undefined) {
      product.sku = asOptionalText(req.body.sku) || product.sku;
    }
    if (req.body.laptopName !== undefined) {
      product.laptopName = requireText(req.body.laptopName, "Laptop name");
    }
    if (req.body.laptopNameAr !== undefined) {
      product.laptopNameAr = asOptionalText(req.body.laptopNameAr);
    }
    if (req.body.brand !== undefined) {
      product.brand = requireText(req.body.brand, "Brand");
    }
    if (req.body.category !== undefined) {
      product.category = asOptionalText(req.body.category);
    }
    if (req.body.categoryAr !== undefined) {
      product.categoryAr = asOptionalText(req.body.categoryAr);
    }
    if (req.body.ram !== undefined) {
      product.ram = normalizeRam(requireText(req.body.ram, "RAM"));
    }
    if (req.body.storage !== undefined) {
      product.storage = normalizeStorage(requireText(req.body.storage, "Storage"));
    }
    if (req.body.purchasePrice !== undefined || req.body.costPrice !== undefined || req.body.cost !== undefined) {
      product.purchasePrice = resolvePurchasePrice({
        purchasePrice: req.body.purchasePrice ?? req.body.costPrice ?? req.body.cost,
      });
    }
    if (req.body.sellingPrice !== undefined || req.body.price !== undefined || req.body.salePrice !== undefined) {
      product.sellingPrice = resolveSellingPrice({
        sellingPrice: req.body.sellingPrice ?? req.body.price ?? req.body.salePrice,
      });
    }
    if (req.body.stock !== undefined) {
      product.stock = Math.max(0, Math.trunc(parseNumber(req.body.stock, product.stock)));
    }
    if (req.body.warrantyMonths !== undefined) {
      product.warrantyMonths = Math.max(
        1,
        Math.trunc(parseNumber(req.body.warrantyMonths, product.warrantyMonths || 12)) || 12,
      );
    }
    if (req.body.discountPercent !== undefined) {
      product.discountPercent = Math.max(
        0,
        Math.min(90, Number(parseNumber(req.body.discountPercent, product.discountPercent || 0).toFixed(2))),
      );
    }
    if (req.body.description !== undefined) {
      product.description = asOptionalText(req.body.description);
    }
    if (req.body.descriptionAr !== undefined) {
      product.descriptionAr = asOptionalText(req.body.descriptionAr);
    }
    if (req.body.imageUrls !== undefined) {
      product.imageUrls = parseImageUrls(req.body.imageUrls);
    }
    if (req.body.shippingInfo !== undefined) {
      product.shippingInfo = asOptionalText(req.body.shippingInfo);
    }
    if (req.body.shippingInfoAr !== undefined) {
      product.shippingInfoAr = asOptionalText(req.body.shippingInfoAr);
    }
    if (req.body.featured !== undefined) {
      product.featured = parseBooleanish(req.body.featured, product.featured);
    }
    if (req.body.bestOffer !== undefined) {
      product.bestOffer = parseBooleanish(req.body.bestOffer, product.bestOffer);
    }
    product.specs ||= {};
    if (req.body.specs || req.body.cpu !== undefined) {
      product.specs.cpu = asOptionalText(req.body.specs?.cpu || req.body.cpu || product.specs.cpu);
    }
    if (req.body.specs || req.body.gpu !== undefined) {
      product.specs.gpu = asOptionalText(req.body.specs?.gpu || req.body.gpu || product.specs.gpu);
    }
    if (req.body.specs || req.body.display !== undefined) {
      product.specs.display = asOptionalText(req.body.specs?.display || req.body.display || product.specs.display);
    }
    if (req.body.specs || req.body.os !== undefined) {
      product.specs.os = asOptionalText(req.body.specs?.os || req.body.os || product.specs.os);
    }
    if (req.body.specs || req.body.weight !== undefined) {
      product.specs.weight = asOptionalText(req.body.specs?.weight || req.body.weight || product.specs.weight);
    }
    if (req.body.specs || req.body.battery !== undefined) {
      product.specs.battery = asOptionalText(req.body.specs?.battery || req.body.battery || product.specs.battery);
    }
    product.specsAr ||= {};
    if (req.body.specsAr || req.body.cpuAr !== undefined) {
      product.specsAr.cpu = asOptionalText(req.body.specsAr?.cpu || req.body.cpuAr || product.specsAr.cpu);
    }
    if (req.body.specsAr || req.body.gpuAr !== undefined) {
      product.specsAr.gpu = asOptionalText(req.body.specsAr?.gpu || req.body.gpuAr || product.specsAr.gpu);
    }
    if (req.body.specsAr || req.body.displayAr !== undefined) {
      product.specsAr.display = asOptionalText(req.body.specsAr?.display || req.body.displayAr || product.specsAr.display);
    }
    if (req.body.specsAr || req.body.osAr !== undefined) {
      product.specsAr.os = asOptionalText(req.body.specsAr?.os || req.body.osAr || product.specsAr.os);
    }
    if (req.body.specsAr || req.body.weightAr !== undefined) {
      product.specsAr.weight = asOptionalText(req.body.specsAr?.weight || req.body.weightAr || product.specsAr.weight);
    }
    if (req.body.specsAr || req.body.batteryAr !== undefined) {
      product.specsAr.battery = asOptionalText(req.body.specsAr?.battery || req.body.batteryAr || product.specsAr.battery);
    }

    product.price = product.sellingPrice;
    product.updatedAt = nowIso();
    await saveDb();

    await addLog({
      action: "update",
      module: "products",
      user: req.user,
      details: `Updated product ${product.laptopName} (${product.sku})`,
      ip: req.ip,
    });

    res.json({ product });
  }),
);

router.post(
  "/:id/images",
  authorize("admin", "products"),
  imageUpload.array("images", 8),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const product = db.products.find((entry) => entry.id === req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found." });
    }

    const uploadedFiles = Array.isArray(req.files) ? req.files : [];
    if (uploadedFiles.length === 0) {
      return res.status(400).json({ error: "At least one image is required." });
    }

    const nextUrls = uploadedFiles.map((file) => `/uploads/products/${path.basename(file.path)}`);
    product.imageUrls = [...(product.imageUrls || []), ...nextUrls].slice(0, 12);
    product.updatedAt = nowIso();
    await saveDb();

    await addLog({
      action: "upload",
      module: "products",
      user: req.user,
      details: `Uploaded ${uploadedFiles.length} image(s) to product ${product.sku}`,
      ip: req.ip,
    });

    res.status(201).json({ imageUrls: product.imageUrls, uploaded: nextUrls });
  }),
);

router.delete(
  "/all",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const removedCount = db.products.length;
    db.products = [];
    await saveDb();

    await addLog({
      action: "delete",
      module: "products",
      user: req.user,
      details: `Cleared entire products catalog (${removedCount} items)`,
      ip: req.ip,
    });

    res.json({ success: true, removedCount });
  }),
);

router.post(
  "/upload",
  authorize("admin"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "Excel file is required." });
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
      return res.status(400).json({ error: "No rows found in Excel file." });
    }

    const db = await getDb();
    let importedCount = 0;
    let skippedCount = 0;

    for (let index = 0; index < rows.length; index += 1) {
      const row = normalizeRowKeys(rows[index]);

      const laptopName = asOptionalText(getValueByAliases(row, FIELD_ALIASES.laptopName));
      if (!laptopName) {
        skippedCount += 1;
        continue;
      }

      const rawBrand = autoDetectBrand(asOptionalText(getValueByAliases(row, FIELD_ALIASES.brand)), laptopName);
      const rawRam = getValueByAliases(row, FIELD_ALIASES.ram);
      const rawStorage = getValueByAliases(row, FIELD_ALIASES.storage);
      const rawCategoryValue = getValueByAliases(row, FIELD_ALIASES.category);
      const rawCategory = asOptionalText(rawCategoryValue);
      const hasCategory = asOptionalText(rawCategoryValue) !== "";

      const purchasePrice = parseNumber(getValueByAliases(row, FIELD_ALIASES.purchasePrice), 0);
      let sellingPrice = parseNumber(getValueByAliases(row, FIELD_ALIASES.sellingPrice), 0);
      
      // If sellingPrice is still 0 but purchasePrice exists, use purchasePrice as base
      if (sellingPrice === 0 && purchasePrice > 0) {
        sellingPrice = purchasePrice;
      }
      
      // Apply global price markup from agent settings if enabled
      const agentSettings = db.storeSettings?.agentSettings || {};
      if (agentSettings.priceMarkupEnabled && sellingPrice > 0) {
        const markupVal = Number(agentSettings.priceMarkupValue) || 0;
        if (agentSettings.priceMarkupType === "percent") {
          sellingPrice = sellingPrice * (1 + markupVal / 100);
        } else {
          sellingPrice = sellingPrice + markupVal;
        }
      }
      
      const stock = Math.max(0, Math.trunc(parseNumber(getValueByAliases(row, FIELD_ALIASES.stock), 0)));
      
      // Use global default warranty from agent settings
      const defaultWarranty = Math.max(1, Number(agentSettings.defaultWarrantyMonths) || 12);
      const warrantyMonths = Math.max(
        1,
        Math.trunc(parseNumber(getValueByAliases(row, FIELD_ALIASES.warrantyMonths), defaultWarranty)) || defaultWarranty,
      );
      const discountPercent = Math.max(
        0,
        Math.min(90, Number(parseNumber(getValueByAliases(row, FIELD_ALIASES.discountPercent), 0).toFixed(2))),
      );
      const rawDescription = getValueByAliases(row, FIELD_ALIASES.description);
      const description = asOptionalText(rawDescription);
      const hasDescription = asOptionalText(rawDescription) !== "";
      const rawImageUrls = getValueByAliases(row, FIELD_ALIASES.imageUrls);
      const imageUrls = parseImageUrls(rawImageUrls);
      const hasImageUrls = asOptionalText(rawImageUrls) !== "";
      const rawShippingInfo = getValueByAliases(row, FIELD_ALIASES.shippingInfo);
      const shippingInfo = asOptionalText(rawShippingInfo);
      const hasShippingInfo = asOptionalText(rawShippingInfo) !== "";
      const rawFeatured = getValueByAliases(row, FIELD_ALIASES.featured);
      const featured = parseBooleanish(rawFeatured);
      const hasFeatured = asOptionalText(rawFeatured) !== "";
      const rawBestOffer = getValueByAliases(row, FIELD_ALIASES.bestOffer);
      const bestOffer = parseBooleanish(rawBestOffer);
      const hasBestOffer = asOptionalText(rawBestOffer) !== "";

      const skuCandidate = asOptionalText(getValueByAliases(row, FIELD_ALIASES.sku));
      const sku = skuCandidate || generateSku(rawBrand, laptopName, index);
      const existing = db.products.find((entry) => entry.sku.toLowerCase() === sku.toLowerCase());

      const payload = {
        sku,
        laptopName,
        brand: rawBrand || "Unknown",
        ram: normalizeRam(rawRam),
        storage: normalizeStorage(rawStorage),
        purchasePrice: Number(purchasePrice.toFixed(2)),
        sellingPrice: Number(sellingPrice.toFixed(2)),
        price: Number(sellingPrice.toFixed(2)),
        stock,
        warrantyMonths,
        discountPercent,
        updatedAt: nowIso(),
      };

      if (hasDescription) {
        payload.description = description;
      }
      if (hasCategory) {
        payload.category = rawCategory;
      }
      if (hasImageUrls) {
        payload.imageUrls = imageUrls;
      }
      if (hasShippingInfo) {
        payload.shippingInfo = shippingInfo;
      }
      if (hasFeatured) {
        payload.featured = featured;
      }
      if (hasBestOffer) {
        payload.bestOffer = bestOffer;
      }

      if (existing) {
        Object.assign(existing, payload);
      } else {
        if (!payload.imageUrls || payload.imageUrls.length === 0) {
          try {
            const fetched = await fetchProductImages(`${payload.brand || ""} ${payload.laptopName || ""}`);
            payload.imageUrls = [fetched.thumbnail, ...fetched.gallery].filter(Boolean);
          } catch (err) {
            console.error("Auto image fetch failed during standard Excel import:", err);
          }
        }
        db.products.push({
          id: nanoid(),
          ...payload,
          createdAt: nowIso(),
        });
      }

      importedCount += 1;
    }

    await saveDb();

    await addLog({
      action: "upload",
      module: "products",
      user: req.user,
      details: `Uploaded Excel products: imported=${importedCount}, skipped=${skippedCount}`,
      ip: req.ip,
    });

    fs.unlink(req.file.path, () => {});

    res.json({ success: true, importedCount, skippedCount });
  }),
);

router.delete(
  "/:id",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const index = db.products.findIndex((entry) => entry.id === req.params.id);
    if (index < 0) {
      return res.status(404).json({ error: "Product not found." });
    }

    const [removed] = db.products.splice(index, 1);
    await saveDb();

    await addLog({
      action: "delete",
      module: "products",
      user: req.user,
      details: `Deleted product ${removed.laptopName} (${removed.sku})`,
      ip: req.ip,
    });

    res.json({ success: true });
  }),
);

export default router;
