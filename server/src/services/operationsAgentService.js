import { asOptionalText, sanitizeText } from "../utils/validation.js";

function boolFromValue(value) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value || "").trim().toLowerCase();
  return ["1", "true", "yes", "y", "on"].includes(normalized);
}

function toMoney(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return String(fallback);
  }
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

function buildProductTitle({ brand, model, cpu, ram, storage }) {
  const base = [brand, model].filter(Boolean).join(" ").trim();
  const specBits = [cpu, ram, storage].filter(Boolean).slice(0, 2);
  if (!base) {
    return "Laptop";
  }
  return [base, ...specBits].join(" ").trim();
}

function buildProductTitleAr({ brand, modelAr, model, cpuAr, cpu, ram, storage }) {
  const visibleModel = modelAr || model;
  const specBits = [cpuAr || cpu, ram, storage].filter(Boolean).slice(0, 2);
  return [brand, visibleModel, ...specBits].filter(Boolean).join(" ").trim() || "لاب توب";
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

export function buildAgentProductDraft(input = {}, settings = {}) {
  const brand = sanitizeText(input.brand || "");
  const model = sanitizeText(input.model || input.laptopName || "");
  const modelAr = sanitizeText(input.modelAr || input.laptopNameAr || "");
  const category = sanitizeText(input.category || "");
  const categoryAr = sanitizeText(input.categoryAr || "");
  const ram = sanitizeText(input.ram || "");
  const storage = sanitizeText(input.storage || "");
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

  const productTitle = buildProductTitle({ brand, model, cpu, ram, storage });
  const productTitleAr = buildProductTitleAr({
    brand,
    modelAr,
    model,
    cpuAr,
    cpu,
    ram,
    storage,
  });

  return {
    sku: normalizeSku(input.sku || `${brand}-${model}`) || `SKU-${Date.now()}`,
    laptopName: productTitle,
    laptopNameAr: productTitleAr,
    brand,
    category,
    categoryAr: normalizeCategoryAr(categoryAr, category),
    ram,
    storage,
    purchasePrice: toMoney(input.purchasePrice, 0),
    sellingPrice: toMoney(input.sellingPrice, 0),
    discountPercent: String(Number(input.discountPercent || 0)),
    stock: String(Math.max(0, Number.parseInt(input.stock || 0, 10) || 0)),
    warrantyMonths: String(Math.max(1, Number.parseInt(input.warrantyMonths || 12, 10) || 12)),
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

export function buildAgentSupportReply({ ticket, linkedOrder, settings = {} }) {
  const topic = detectTopic(ticket, linkedOrder);
  const supportTone = normalizeTone(settings.supportReplyTone, "friendly");
  const reply = applySupportTone(
    `${buildReplyIntro(ticket?.customerName)} ${buildSupportReplyBody(topic, linkedOrder)}`.trim(),
    supportTone,
  );
  const replyAr = applySupportToneAr(
    `${buildReplyIntroAr(ticket?.customerName)} ${buildSupportReplyBodyAr(topic, linkedOrder)}`.trim(),
    supportTone,
  );

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
