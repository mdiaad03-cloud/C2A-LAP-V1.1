import { asOptionalText, sanitizeText } from "../utils/validation.js";

function boolFromValue(value) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value || "").trim().toLowerCase();
  return ["1", "true", "yes", "y", "on"].includes(normalized);
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

function toMoney(value, fallback = 0) {
  const parsed = parseNumber(value, fallback);
  return String(Number(parsed.toFixed(2)));
}

function normalizeSku(text) {
  return String(text || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 32);
}

function normalizeTone(value, fallback) {
  return String(value || "")
    .trim()
    .toLowerCase()
    || fallback;
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

function cleanModelName(brand, model) {
  let clean = String(model || "").trim();
  if (!clean) return "";

  // Strip trailing specs parts starting with spaces/hyphens/slashes
  // e.g. -XEON..., -I7..., /I5..., RYZEN..., core i..., gen...
  const cleanRegex = /\s*(?:[-/|]\s*)?(?:xeon|core|i[3579]|ryzen|r[3579]|intel|amd|gen|generation)\b.*/i;
  clean = clean.replace(cleanRegex, "").trim();
  
  const brandLower = String(brand || "").trim().toLowerCase();
  if (brandLower) {
    let lastClean = "";
    while (clean !== lastClean) {
      lastClean = clean;
      clean = clean.replace(new RegExp(`^${brandLower}\\s*`, "i"), "").trim();
    }
  }
  return clean;
}

function buildProductTitle({ brand, model }) {
  const cleanModel = cleanModelName(brand, model);
  const base = [brand, cleanModel].filter(Boolean).join(" ").trim();
  if (!base) {
    return "Laptop";
  }
  return base;
}

function buildProductTitleAr({ brand, modelAr, model }) {
  const visibleModel = modelAr || model;
  const cleanModel = cleanModelName(brand, visibleModel);
  return [brand, cleanModel].filter(Boolean).join(" ").trim() || "لاب توب";
}

function normalizeCategoryAr(categoryAr, category) {
  if (categoryAr) {
    return categoryAr;
  }

  const normalized = String(category || "").trim().toLowerCase();
  const lookup = {
    business: "أعمال",
    gaming: "ألعاب",
    ultrabook: "ألترا بوك",
    workstation: "محطة عمل",
    student: "طلاب",
    convertible: "قابل للتحويل",
  };
  return lookup[normalized] || category || "";
}

function buildDescription({ brand, model, ram, storage, cpu, gpu, display, os }) {
  const intro = `${brand} ${model}`.trim();
  const features = [
    ram ? `${ram} RAM` : "",
    storage ? `${storage} storage` : "",
    cpu ? `${cpu} processor` : "",
    gpu ? `${gpu} graphics` : "",
    display ? `${display} display` : "",
    os ? `${os}` : "",
  ].filter(Boolean);

  return `${intro} is a reliable laptop configured with ${features.join(", ")}. It is suitable for daily work, study, and smooth multitasking.`.trim();
}

function buildDescriptionAr({ brand, modelAr, model, ram, storage, cpuAr, cpu, gpuAr, gpu, displayAr, display, osAr, os }) {
  const intro = `${brand} ${modelAr || model}`.trim();
  const features = [
    ram ? `ذاكرة ${ram}` : "",
    storage ? `مساحة تخزين ${storage}` : "",
    cpuAr || cpu ? `معالج ${cpuAr || cpu}` : "",
    gpuAr || gpu ? `كارت شاشة ${gpuAr || gpu}` : "",
    displayAr || display ? `شاشة ${displayAr || display}` : "",
    osAr || os ? `نظام ${osAr || os}` : "",
  ].filter(Boolean);

  return `${intro} لاب توب مناسب للشغل والدراسة والاستخدام اليومي، ويأتي مع ${features.join("، ")} لتجربة مستقرة وسريعة.`.trim();
}

function applyProductTone(text, tone) {
  if (tone === "premium") {
    return `${text} It also adds a premium touch for customers who care about design as much as performance.`.trim();
  }
  if (tone === "technical") {
    return `${text} The configuration is written in a more technical style for customers who compare hardware details before buying.`.trim();
  }
  return text;
}

function applyProductToneAr(text, tone) {
  if (tone === "premium") {
    return `${text} كما يمنح إحساسًا فاخرًا مناسبًا للعملاء الذين يهتمون بالتصميم مع الأداء.`.trim();
  }
  if (tone === "technical") {
    return `${text} كما يتم عرض المواصفات بصياغة تقنية أوضح للعملاء الذين يقارنون التفاصيل قبل الشراء.`.trim();
  }
  return text;
}

function buildShippingInfo(shippingInfo) {
  return (
    asOptionalText(shippingInfo)
    || "Ships within 1-2 business days with careful packaging and delivery tracking."
  );
}

function buildShippingInfoAr(shippingInfoAr) {
  return (
    asOptionalText(shippingInfoAr)
    || "يتم الشحن خلال 1-2 يوم عمل مع تغليف آمن وإمكانية متابعة الطلب."
  );
}

function detectTopic(ticket, linkedOrder) {
  const text = [
    ticket?.subject,
    ...(ticket?.messages || []).slice(0, 3).map((message) => message.body),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/(ship|shipping|tracking|delivery|courier|مندوب|شحن|توصيل|تتبع)/.test(text)) {
    return "shipping";
  }
  if (/(price|discount|offer|سعر|خصم|عرض)/.test(text)) {
    return "pricing";
  }
  if (/(problem|issue|broken|defect|support|مشكلة|عطل|دعم|ضمان)/.test(text)) {
    return "support";
  }
  if (linkedOrder) {
    return "order";
  }
  return "general";
}

function buildReplyIntro(name) {
  return `Hello ${name || "there"}, thanks for reaching out to C2A LAP.`;
}

function buildReplyIntroAr(name) {
  return `أهلًا ${name || "بحضرتك"}، شكرًا لتواصلك مع C2A LAP.`;
}

function buildSupportReplyBody(topic, linkedOrder) {
  if (topic === "shipping" && linkedOrder) {
    return `Your order ${linkedOrder.orderNumber} is currently marked as ${linkedOrder.status}. ${
      linkedOrder.trackingNumber ? `Tracking number: ${linkedOrder.trackingNumber}. ` : ""
    }Our team will keep following the shipment and update you once there is movement.`;
  }

  if (topic === "pricing") {
    return "We reviewed your question and our team can confirm the latest available price, stock, and current offers for the requested device.";
  }

  if (topic === "support") {
    return "We logged your issue and the support team is reviewing it carefully. If needed, we may ask for extra details like photos or a short video to speed up the solution.";
  }

  if (topic === "order" && linkedOrder) {
    return `We found order ${linkedOrder.orderNumber} for you, and we are checking its latest status now. Our team will update you shortly with the next step.`;
  }

  return "We received your message and our team is reviewing it now. We will follow up with the best possible update as soon as possible.";
}

function buildSupportReplyBodyAr(topic, linkedOrder) {
  if (topic === "shipping" && linkedOrder) {
    return `طلبك رقم ${linkedOrder.orderNumber} حالته الحالية هي ${linkedOrder.status}. ${
      linkedOrder.trackingNumber ? `رقم التتبع: ${linkedOrder.trackingNumber}. ` : ""
    }وفريقنا سيتابع الشحنة ويبلغك بأي تحديث جديد.`;
  }

  if (topic === "pricing") {
    return "راجعنا استفسارك، وفريقنا يقدر يؤكد لك السعر الحالي والمخزون وأي عروض متاحة على الجهاز المطلوب.";
  }

  if (topic === "support") {
    return "تم تسجيل المشكلة، وفريق الدعم يراجعها الآن بعناية. ولو احتجنا تفاصيل إضافية مثل صور أو فيديو قصير سنتواصل معك مباشرة لتسريع الحل.";
  }

  if (topic === "order" && linkedOrder) {
    return `وجدنا طلبك رقم ${linkedOrder.orderNumber}، ونراجع حالته الآن، وسنرجع لك بأقرب تحديث والخطوة التالية.`;
  }

  return "وصلتنا رسالتك، وفريقنا يراجعها الآن، وسنرد عليك بأفضل تحديث ممكن في أقرب وقت.";
}

function applySupportTone(text, tone) {
  if (tone === "formal") {
    return `${text} We appreciate your patience and will continue following this request until it is resolved.`.trim();
  }
  if (tone === "short") {
    return text;
  }
  return `${text} If you need anything else, we are happy to help.`.trim();
}

function applySupportToneAr(text, tone) {
  if (tone === "formal") {
    return `${text} نشكرك على صبرك، وسنواصل متابعة الطلب حتى يتم حله بالكامل.`.trim();
  }
  if (tone === "short") {
    return text;
  }
  return `${text} وإذا احتجت أي مساعدة إضافية فنحن معك.`.trim();
}

export function autoDetectBrand(currentBrand, name) {
  const brandClean = String(currentBrand || "").trim().toLowerCase();
  if (
    brandClean &&
    brandClean !== "unknown" &&
    brandClean !== "غير معروف" &&
    brandClean !== "unknown brand"
  ) {
    return currentBrand;
  }

  const nameLower = String(name || "").toLowerCase();

  // First check specific series/sub-brands to map to main manufacturers
  const subBrands = {
    hp: ["elitebook", "probook", "zbook", "envy", "spectre", "pavilion", "victus", "omen"],
    dell: ["latitude", "precision", "inspiron", "vostro", "xps", "alienware"],
    lenovo: ["thinkpad", "ideapad", "legion", "yoga", "thinkbook"],
    asus: ["zenbook", "rog", "tuf", "vivobook"],
    acer: ["aspire", "predator", "nitro"],
    apple: ["macbook", "imac", "mac mini", "mac studio", "ipad"]
  };

  for (const [mainBrand, seriesList] of Object.entries(subBrands)) {
    for (const series of seriesList) {
      if (nameLower.includes(series)) {
        return mainBrand === "hp" ? "HP" : mainBrand.charAt(0).toUpperCase() + mainBrand.slice(1);
      }
    }
  }

  const COMMON_BRANDS = [
    "hp",
    "dell",
    "lenovo",
    "asus",
    "acer",
    "apple",
    "toshiba",
    "microsoft",
    "msi",
    "samsung",
    "huawei",
    "gigabyte",
    "fujitsu",
    "sony",
  ];
  for (const b of COMMON_BRANDS) {
    if (nameLower.includes(b)) {
      if (b === "hp") return "HP";
      if (b === "dell") return "Dell";
      if (b === "lenovo") return "Lenovo";
      if (b === "asus") return "Asus";
      if (b === "acer") return "Acer";
      if (b === "apple") return "Apple";
      if (b === "toshiba") return "Toshiba";
      if (b === "microsoft") return "Microsoft";
      if (b === "msi") return "MSI";
      if (b === "samsung") return "Samsung";
      if (b === "huawei") return "Huawei";
      if (b === "gigabyte") return "Gigabyte";
      return b.charAt(0).toUpperCase() + b.slice(1);
    }
  }

  return currentBrand || "Unknown";
}


export function buildAgentProductDraft(input = {}, settings = {}) {
  const model = sanitizeText(input.model || input.laptopName || "");
  const brand = autoDetectBrand(sanitizeText(input.brand || ""), model);
  const modelAr = sanitizeText(input.modelAr || input.laptopNameAr || "");
  const category = sanitizeText(input.category || "");
  const categoryAr = sanitizeText(input.categoryAr || "");
  const ram = normalizeRam(input.ram);
  const storage = normalizeStorage(input.storage);
  const cpu = sanitizeText(input.cpu || "");
  const cpuAr = sanitizeText(input.cpuAr || "");
  const gpu = sanitizeText(input.gpu || "");
  const gpuAr = sanitizeText(input.gpuAr || "");
  const display = sanitizeText(input.display || "");
  const displayAr = sanitizeText(input.displayAr || "");
  const os = sanitizeText(input.os || "");
  const osAr = sanitizeText(input.osAr || "");
  const weight = sanitizeText(input.weight || "");
  const weightAr = sanitizeText(input.weightAr || "");
  const battery = sanitizeText(input.battery || "");
  const batteryAr = sanitizeText(input.batteryAr || "");
  const productTone = normalizeTone(settings.productDescriptionTone, "professional");

  const productTitle = buildProductTitle({ brand, model });
  const productTitleAr = buildProductTitleAr({ brand, modelAr, model });

  const basePurchasePrice = parseNumber(input.purchasePrice, 0);
  const baseSellingPrice = parseNumber(input.sellingPrice || input.purchasePrice, 0);
  
  let finalSellingPrice = baseSellingPrice;
  if (settings.priceMarkupEnabled) {
    const markupVal = Number(settings.priceMarkupValue) || 0;
    if (settings.priceMarkupType === "percent") {
      finalSellingPrice = baseSellingPrice * (1 + markupVal / 100);
    } else {
      finalSellingPrice = baseSellingPrice + markupVal;
    }
  }

  const defaultWarranty = Math.max(1, Number(settings.defaultWarrantyMonths) || 12);
  const finalWarrantyMonths = String(Math.max(1, Number.parseInt(input.warrantyMonths || defaultWarranty, 10) || 12));

  return {
    sku: normalizeSku(input.sku || `${brand}-${model}`) || `SKU-${Date.now()}`,
    laptopName: productTitle,
    laptopNameAr: productTitleAr,
    brand,
    category,
    categoryAr: normalizeCategoryAr(categoryAr, category),
    ram,
    storage,
    purchasePrice: toMoney(basePurchasePrice, 0),
    sellingPrice: toMoney(finalSellingPrice, 0),
    discountPercent: String(Number(input.discountPercent || 0)),
    stock: String(Math.max(0, Number.parseInt(input.stock || 0, 10) || 0)),
    warrantyMonths: finalWarrantyMonths,
    description: applyProductTone(
      buildDescription({ brand, model, ram, storage, cpu, gpu, display, os }),
      productTone,
    ),
    descriptionAr: applyProductToneAr(
      buildDescriptionAr({
        brand,
        modelAr,
        model,
        ram,
        storage,
        cpuAr,
        cpu,
        gpuAr,
        gpu,
        displayAr,
        display,
        osAr,
        os,
      }),
      productTone,
    ),
    imageUrls: asOptionalText(input.imageUrls),
    shippingInfo: buildShippingInfo(input.shippingInfo),
    shippingInfoAr: buildShippingInfoAr(input.shippingInfoAr),
    cpu,
    cpuAr: cpuAr || cpu,
    gpu,
    gpuAr: gpuAr || gpu,
    display,
    displayAr: displayAr || display,
    os,
    osAr: osAr || os,
    weight,
    weightAr: weightAr || weight,
    battery,
    batteryAr: batteryAr || battery,
    featured: boolFromValue(input.featured),
    bestOffer: boolFromValue(input.bestOffer),
  };
}

function findMatchingProducts(text, db) {
  if (!text || !db?.products) return [];
  const words = String(text).toLowerCase().split(/\s+/);
  const keywords = words.filter(w => w.length > 2 && !["the", "and", "for", "with", "laptop", "this", "need", "want", "about", "please", "price", "show", "give", "سعر", "متاح", "لاب"].includes(w));
  if (keywords.length === 0) return [];
  
  return db.products.filter(p => {
    const pText = `${p.brand} ${p.laptopName}`.toLowerCase();
    return keywords.some(kw => pText.includes(kw)) && p.stock > 0;
  }).slice(0, 3);
}

function buildOrderStatusDetails(order) {
  if (!order) return "";
  const paymentMethodStr = order.paymentMethod === "paymob_egypt" ? "Paymob Egypt" : "Cash on Delivery (COD)";
  const paymentStatusStr = order.paymentStatus === "paid" ? "Paid" : "Pending/Unpaid";
  let details = `Order Status: ${order.status.toUpperCase()} (Payment: ${paymentMethodStr}, Status: ${paymentStatusStr}).`;
  if (order.trackingNumber) {
    details += ` Shipped via Bosta (Tracking: ${order.trackingNumber}). Track here: https://tracking.bosta.co/tracker/${order.trackingNumber}`;
  }
  return details;
}

function buildOrderStatusDetailsAr(order) {
  if (!order) return "";
  const paymentMethodStr = order.paymentMethod === "paymob_egypt" ? "بايموب (الدفع الإلكتروني)" : "الدفع عند الاستلام (COD)";
  const paymentStatusStr = order.paymentStatus === "paid" ? "تم الدفع" : "قيد الدفع / غير مدفوع";
  let details = `حالة الطلب: ${order.status === "delivered" ? "تم التوصيل" : order.status === "shipped" ? "تم الشحن" : "قيد المراجعة"} (طريقة الدفع: ${paymentMethodStr}، حالة الدفع: ${paymentStatusStr}).`;
  if (order.trackingNumber) {
    details += ` الشحن مع شركة بوسطة (رقم التتبع: ${order.trackingNumber}). يمكنك التتبع هنا: https://tracking.bosta.co/tracker/${order.trackingNumber}`;
  }
  return details;
}

export function buildAgentSupportReply({ ticket, linkedOrder, settings = {}, db }) {
  const topic = detectTopic(ticket, linkedOrder);
  const supportTone = normalizeTone(settings.supportReplyTone, "friendly");
  
  let intro = buildReplyIntro(ticket?.customerName);
  let introAr = buildReplyIntroAr(ticket?.customerName);
  
  let body = "";
  let bodyAr = "";
  
  const textContent = `${ticket?.subject || ""} ${ticket?.messages?.[0]?.body || ""}`.toLowerCase();
  
  if (topic === "shipping" && linkedOrder) {
    body = `Your order ${linkedOrder.orderNumber} is marked as ${linkedOrder.status}. ${
      linkedOrder.trackingNumber ? `It is shipped via Bosta with tracking number: ${linkedOrder.trackingNumber}. You can track it live here: https://tracking.bosta.co/tracker/${linkedOrder.trackingNumber}. ` : "We are preparing it for shipment. "
    }Payment Status: ${linkedOrder.paymentStatus}.`;
    
    bodyAr = `طلبك رقم ${linkedOrder.orderNumber} حالته الحالية هي ${linkedOrder.status === "delivered" ? "تم التوصيل" : linkedOrder.status === "shipped" ? "تم الشحن" : "قيد التجهيز"}. ${
      linkedOrder.trackingNumber ? `تم شحنه مع شركة بوسطة برقم تتبع: ${linkedOrder.trackingNumber}. يمكنك تتبع الشحنة مباشرة من هنا: https://tracking.bosta.co/tracker/${linkedOrder.trackingNumber}. ` : "نحن نجهز الطلب للشحن الآن. "
    }حالة الدفع: ${linkedOrder.paymentStatus === "paid" ? "تم الدفع" : "الدفع عند الاستلام"}.`;
  } else if (topic === "pricing" || textContent.includes("laptop") || textContent.includes("سعر") || textContent.includes("لاب") || textContent.includes("متاح")) {
    const matchingProducts = findMatchingProducts(textContent, db);
    if (matchingProducts.length > 0) {
      const prodList = matchingProducts.map(p => `- ${p.brand} ${p.laptopName} (${p.sellingPrice} EGP, Stock: ${p.stock} units)`).join("\n");
      const prodListAr = matchingProducts.map(p => `- ${p.brand} ${p.laptopName} (السعر: ${p.sellingPrice} جنيه، المخزون: ${p.stock} قطعة)`).join("\n");
      
      body = `We have found some matching laptops in stock for you:\n${prodList}\nWould you like to place an order?`;
      bodyAr = `لقد وجدنا بعض الأجهزة المتاحة في المخزن حاليًا والمناسبة لاستفسارك:\n${prodListAr}\nهل تحب أن نساعدك في عمل طلب شراء؟`;
    } else {
      body = "We reviewed your question and our team can confirm the latest available price, stock, and current offers for the requested device.";
      bodyAr = "راجعنا استفسارك، وفريقنا يقدر يؤكد لك السعر الحالي والمخزون وأي عروض متاحة على الجهاز المطلوب.";
    }
  } else if (topic === "support") {
    body = "We logged your issue and the support team is reviewing it carefully. If needed, we may ask for extra details like photos or a short video to speed up the solution.";
    bodyAr = "تم تسجيل المشكلة، وفريق الدعم يراجعها الآن بعناية. ولو احتجنا تفاصيل إضافية مثل صور أو فيديو قصير سنتواصل معك مباشرة لتسريع الحل.";
  } else if (topic === "order" && linkedOrder) {
    body = `We found order ${linkedOrder.orderNumber} for you. ${buildOrderStatusDetails(linkedOrder)}`;
    bodyAr = `وجدنا طلبك رقم ${linkedOrder.orderNumber}. ${buildOrderStatusDetailsAr(linkedOrder)}`;
  } else {
    body = "We received your message and our team is reviewing it now. We will follow up with the best possible update as soon as possible.";
    bodyAr = "وصلتنا رسالتك، وفريقنا يراجعها الآن، وسنرد عليك بأفضل تحديث ممكن في أقرب وقت.";
  }
  
  const reply = applySupportTone(`${intro} ${body}`.trim(), supportTone);
  const replyAr = applySupportToneAr(`${introAr} ${bodyAr}`.trim(), supportTone);
  
  return {
    topic,
    recommendedStatus: ticket?.status === "open" ? "in_progress" : ticket?.status || "open",
    reply,
    replyAr,
  };
}

export function buildAgentShippingDraft(order, settings = {}) {
  const defaultCompanyName = asOptionalText(settings.defaultShippingCompanyName) || "C2A LAP Delivery";
  const defaultShippingStatus = asOptionalText(settings.defaultShippingStatus) || "in_transit";
  const companyName = asOptionalText(order?.shippingCompanyName) || defaultCompanyName;
  const shippingPhone = asOptionalText(order?.shippingCompanyPhone);
  const trackingNumber = asOptionalText(order?.trackingNumber) || `TRK-${String(order?.orderNumber || "").slice(-6)}`;

  return {
    status: "shipped",
    shippingStatus: defaultShippingStatus,
    shippingCompanyName: companyName,
    shippingCompanyPhone: shippingPhone,
    trackingNumber,
    summary: {
      en: `Order ${order?.orderNumber} is ready to move to shipped status.`,
      ar: `الطلب ${order?.orderNumber} جاهز للتحويل إلى تم الشحن.`,
    },
  };
}
