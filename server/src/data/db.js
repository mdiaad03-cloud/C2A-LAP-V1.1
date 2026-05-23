import fs from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { JSONFilePreset } from "lowdb/node";
import { initialShippingCompanies, initialUsers } from "./seed.js";
import { nowIso } from "../utils/dateUtils.js";

const dataPath = path.resolve("src/data/db.json");

const defaultFaqItems = [
  {
    id: "01",
    question: "Do you offer installment plans?",
    questionAr: "هل توفرون أنظمة تقسيط؟",
    answer: "Yes. Payment plans depend on the available bank or finance provider at the time of purchase.",
    answerAr: "نعم، خيارات التقسيط تعتمد على البنك أو شركة التمويل المتاحة وقت الشراء.",
  },
  {
    id: "02",
    question: "Do you have a physical showroom?",
    questionAr: "هل لديكم معرض فعلي؟",
    answer: "Yes. You can order online at any time and visit our showroom during business hours when needed.",
    answerAr: "نعم. يمكنك الطلب أونلاين في أي وقت وزيارة المعرض خلال ساعات العمل عند الحاجة.",
  },
  {
    id: "03",
    question: "What about warranty coverage?",
    questionAr: "ماذا عن الضمان؟",
    answer: "Every product includes the warranty period shown on its page, and the admin team can confirm the start date after delivery.",
    answerAr: "كل منتج يشمل مدة الضمان الموضحة في صفحته، ويمكن لفريق الإدارة تأكيد بداية الضمان بعد التسليم.",
  },
  {
    id: "04",
    question: "How long does shipping take?",
    questionAr: "كم تستغرق مدة التوصيل؟",
    answer: "Delivery time depends on the destination city and the selected shipping company, usually within 1-5 business days.",
    answerAr: "مدة التوصيل تعتمد على المدينة وشركة الشحن المختارة، وعادة تكون خلال 1-5 أيام عمل.",
  },
];

const defaultStoreContent = {
  heroBadge: "C2A LAP E-commerce",
  heroBadgeAr: "متجر C2A LAP",
  heroTitle: "Premium laptops, synchronized with real-time inventory.",
  heroTitleAr: "لابتوبات احترافية مرتبطة بالمخزون لحظيًا.",
  heroSubtitle: "Browse powerful devices, place orders instantly, and track every purchase through secure checkout.",
  heroSubtitleAr: "تصفح أجهزة قوية، اطلب مباشرة، وتابع كل عملية شراء عبر دفع آمن.",
  primaryCtaLabel: "Shop Laptops",
  primaryCtaLabelAr: "تسوق اللابتوبات",
  secondaryCtaLabel: "Go To Cart",
  secondaryCtaLabelAr: "اذهب إلى السلة",
  featuredTitle: "Featured Laptops",
  featuredTitleAr: "منتجات مميزة",
  offersTitle: "Best Offers",
  offersTitleAr: "أفضل العروض",
  offersSubtitle: "Hand-picked discounted devices with instant checkout.",
  offersSubtitleAr: "أجهزة مخفضة مختارة مع شراء سريع وآمن.",
  brandsTitle: "Popular Brands",
  brandsTitleAr: "أشهر الماركات",
  faqTitle: "Frequently Asked Questions",
  faqTitleAr: "الأسئلة الشائعة",
  faqSubtitle: "Answers for the most common customer questions.",
  faqSubtitleAr: "إجابات لأكثر الأسئلة شيوعًا لدى العملاء.",
  faqItems: defaultFaqItems,
};

const defaultStoreFeatures = {
  reviewsEnabled: true,
};

const defaultSocialLinks = {
  whatsapp: { enabled: false, url: "" },
  facebook: { enabled: false, url: "" },
  instagram: { enabled: false, url: "" },
  tiktok: { enabled: false, url: "" },
};

const defaultAgentSettings = {
  productDraftEnabled: true,
  supportReplyEnabled: true,
  shippingAgentEnabled: true,
  excelImportEnabled: true,
  autoMoveTicketsToInProgress: true,
  defaultShippingCompanyName: "Bosta",
  defaultShippingStatus: "pickup_requested",
  productDescriptionTone: "professional",
  supportReplyTone: "friendly",
  defaultWarrantyMonths: 12,
  priceMarkupEnabled: false,
  priceMarkupType: "fixed",
  priceMarkupValue: 0,
};

const defaultData = {
  meta: {
    app: "C2A LAP Sales Management",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  users: [],
  sales: [],
  contacts: [],
  products: [],
  onlineOrders: [],
  supportTickets: [],
  storeSettings: {
    shippingFlatRate: 25,
    freeShippingThreshold: 2000,
    lowStockThreshold: 3,
    categories: ["Gaming", "Business", "Student", "Ultrabook"],
    content: defaultStoreContent,
    features: defaultStoreFeatures,
    socialLinks: defaultSocialLinks,
    agentSettings: defaultAgentSettings,
  },
  shippingCompanies: [],
  logs: [],
  notifications: [],
};

let dbInstance;

export async function initializeDb() {
  if (dbInstance) {
    return dbInstance;
  }

  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  dbInstance = await JSONFilePreset(dataPath, defaultData);

  if (!dbInstance.data || typeof dbInstance.data !== "object") {
    dbInstance.data = structuredClone(defaultData);
  }

  await ensureRequiredCollections();
  await seedDefaults();

  return dbInstance;
}

async function ensureRequiredCollections() {
  const db = dbInstance.data;
  db.meta ||= { app: "C2A LAP Sales Management", createdAt: nowIso(), updatedAt: nowIso() };
  db.users ||= [];
  db.sales ||= [];
  db.contacts ||= [];
  db.products ||= [];
  db.onlineOrders ||= [];
  db.supportTickets ||= [];
  db.coupons ||= [];
  db.storeSettings ||= {
    shippingFlatRate: 25,
    freeShippingThreshold: 2000,
    lowStockThreshold: 3,
    categories: ["Gaming", "Business", "Student", "Ultrabook"],
    content: defaultStoreContent,
    features: defaultStoreFeatures,
    socialLinks: defaultSocialLinks,
    agentSettings: defaultAgentSettings,
  };
  db.storeSettings.shippingFlatRate = Number(db.storeSettings.shippingFlatRate ?? 25) || 25;
  db.storeSettings.freeShippingThreshold = Number(db.storeSettings.freeShippingThreshold ?? 2000) || 2000;
  db.storeSettings.lowStockThreshold = Number(db.storeSettings.lowStockThreshold ?? 3) || 3;
  db.storeSettings.categories = Array.isArray(db.storeSettings.categories)
    ? db.storeSettings.categories.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 30)
    : ["Gaming", "Business", "Student", "Ultrabook"];
  db.storeSettings.content ||= {};
  const normalizedFaqItems = Array.isArray(db.storeSettings.content.faqItems)
    ? db.storeSettings.content.faqItems
        .map((item, index) => ({
          id: String(item?.id || "").trim() || String(index + 1).padStart(2, "0"),
          question: String(item?.question || "").trim(),
          questionAr: String(item?.questionAr || "").trim(),
          answer: String(item?.answer || "").trim(),
          answerAr: String(item?.answerAr || "").trim(),
        }))
        .filter((item) => item.question && item.answer)
        .slice(0, 8)
    : [];
  db.storeSettings.content = {
    ...defaultStoreContent,
    ...db.storeSettings.content,
    faqItems: normalizedFaqItems.length > 0 ? normalizedFaqItems : structuredClone(defaultFaqItems),
  };
  db.storeSettings.features = {
    ...defaultStoreFeatures,
    ...(db.storeSettings.features || {}),
    reviewsEnabled: db.storeSettings.features?.reviewsEnabled !== false,
  };
  db.storeSettings.socialLinks = {
    ...defaultSocialLinks,
    ...(db.storeSettings.socialLinks || {}),
    whatsapp: {
      ...defaultSocialLinks.whatsapp,
      ...(db.storeSettings.socialLinks?.whatsapp || {}),
    },
    facebook: {
      ...defaultSocialLinks.facebook,
      ...(db.storeSettings.socialLinks?.facebook || {}),
    },
    instagram: {
      ...defaultSocialLinks.instagram,
      ...(db.storeSettings.socialLinks?.instagram || {}),
    },
    tiktok: {
      ...defaultSocialLinks.tiktok,
      ...(db.storeSettings.socialLinks?.tiktok || {}),
    },
  };
  db.storeSettings.agentSettings = {
    ...defaultAgentSettings,
    ...(db.storeSettings.agentSettings || {}),
    productDraftEnabled: db.storeSettings.agentSettings?.productDraftEnabled !== false,
    supportReplyEnabled: db.storeSettings.agentSettings?.supportReplyEnabled !== false,
    shippingAgentEnabled: db.storeSettings.agentSettings?.shippingAgentEnabled !== false,
    excelImportEnabled: db.storeSettings.agentSettings?.excelImportEnabled !== false,
    autoMoveTicketsToInProgress: db.storeSettings.agentSettings?.autoMoveTicketsToInProgress !== false,
  };
  db.shippingCompanies ||= [];
  db.logs ||= [];
  db.notifications ||= [];
  db.meta.updatedAt = nowIso();
  await dbInstance.write();
}

async function seedDefaults() {
  const db = dbInstance.data;

  if (db.users.length === 0) {
    for (const user of initialUsers) {
      db.users.push({
        id: user.id,
        name: user.name,
        username: user.username,
        passwordHash: await bcrypt.hash(user.password, 10),
        role: user.role,
        isActive: user.isActive,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        lastLoginAt: null,
      });
    }
  }

  if (db.shippingCompanies.length === 0) {
    db.shippingCompanies = initialShippingCompanies.map((company) => ({
      ...company,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }));
  }

  db.coupons ||= [];
  if (!db.coupons.some((c) => c.code.toUpperCase() === "FIRST200")) {
    db.coupons.push({
      id: nanoid(),
      code: "FIRST200",
      type: "fixed",
      value: 200,
      usageLimit: 0,
      usageCount: 0,
      isActive: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      isFirstOrderOnly: true,
    });
  }

  db.meta.updatedAt = nowIso();
  await dbInstance.write();
}

export async function getDb() {
  const db = await initializeDb();
  return db.data;
}

let writeQueue = Promise.resolve();

export async function saveDb() {
  if (!dbInstance) {
    await initializeDb();
  }
  dbInstance.data.meta.updatedAt = nowIso();
  
  writeQueue = writeQueue.then(async () => {
    try {
      await dbInstance.write();
    } catch (error) {
      console.error("Database save failed:", error);
      throw error;
    }
  });

  return writeQueue;
}

export async function getRawDbPath() {
  await initializeDb();
  return dataPath;
}
