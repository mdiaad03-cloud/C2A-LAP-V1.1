import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { JSONFilePreset } from "lowdb/node";
import { initialShippingCompanies, initialUsers } from "./seed.js";
import { nowIso } from "../utils/dateUtils.js";
import { MongoClient } from "mongodb";

// ============ MongoDB Cloud Sync ============
let mongoClient = null;
let mongoCollection = null;

async function connectMongo() {
  const uri = process.env.MONGODB_URI || "";
  if (!uri) return false;
  try {
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    const db = mongoClient.db("c2a_lap");
    mongoCollection = db.collection("app_state");
    console.log("[DB] ✅ MongoDB Atlas connected — data will persist across deploys!");
    return true;
  } catch (err) {
    console.error("[DB] ❌ MongoDB connection failed:", err.message);
    mongoClient = null;
    mongoCollection = null;
    return false;
  }
}

async function loadFromMongo() {
  if (!mongoCollection) return null;
  try {
    const doc = await mongoCollection.findOne({ _id: "main_db" });
    if (doc && doc.data) {
      console.log(`[DB] Restored data from MongoDB (updated: ${doc.data?.meta?.updatedAt || "unknown"})`);
      return doc.data;
    }
  } catch (err) {
    console.error("[DB] MongoDB load failed:", err.message);
  }
  return null;
}

async function saveToMongo(data) {
  if (!mongoCollection) return;
  try {
    await mongoCollection.replaceOne(
      { _id: "main_db" },
      { _id: "main_db", data, savedAt: new Date().toISOString() },
      { upsert: true }
    );
  } catch (err) {
    console.error("[DB] MongoDB save failed:", err.message);
  }
}
// ============================================

// Use Railway persistent volume if available, otherwise local path
function resolveDataPath() {
  // Railway Volume mount path (set via env or default /data)
  const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || "";
  if (volumePath && fsSync.existsSync(volumePath)) {
    const dbDir = path.join(volumePath, "db");
    if (!fsSync.existsSync(dbDir)) {
      fsSync.mkdirSync(dbDir, { recursive: true });
    }
    console.log(`[DB] Using persistent volume: ${path.join(dbDir, "db.json")}`);
    return path.join(dbDir, "db.json");
  }
  // Fallback: local development path
  return path.resolve("src/data/db.json");
}

const dataPath = resolveDataPath();

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

  // Connect to MongoDB first (if URI is set)
  await connectMongo();

  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  dbInstance = await JSONFilePreset(dataPath, defaultData);

  if (!dbInstance.data || typeof dbInstance.data !== "object") {
    dbInstance.data = structuredClone(defaultData);
  }

  // Try to restore from MongoDB cloud (if local data is empty/default)
  const cloudData = await loadFromMongo();
  if (cloudData) {
    const localOrders = dbInstance.data.onlineOrders?.length || 0;
    const cloudOrders = cloudData.onlineOrders?.length || 0;
    const localUsers = dbInstance.data.users?.length || 0;
    const cloudUsers = cloudData.users?.length || 0;

    // Use cloud data if it has more content (local was wiped by deploy)
    if (cloudOrders > localOrders || cloudUsers > localUsers) {
      console.log(`[DB] Cloud data is newer (cloud: ${cloudOrders} orders, ${cloudUsers} users | local: ${localOrders} orders, ${localUsers} users). Restoring...`);
      dbInstance.data = cloudData;
      await dbInstance.write();
    }
  }

  await ensureRequiredCollections();
  await seedDefaults();

  // Save initial state to MongoDB (including any new seeds)
  await saveToMongo(dbInstance.data);

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
  if (!db.coupons.some((c) => c.code.toUpperCase() === "WELCOME100")) {
    db.coupons.push({
      id: nanoid(),
      code: "WELCOME100",
      type: "fixed",
      value: 100,
      usageLimit: 0,
      usageCount: 0,
      isActive: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      isFirstOrderOnly: false,
    });
  }
  if (!db.coupons.some((c) => c.code.toUpperCase() === "C2A10")) {
    db.coupons.push({
      id: nanoid(),
      code: "C2A10",
      type: "percent",
      value: 10,
      usageLimit: 0,
      usageCount: 0,
      isActive: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      isFirstOrderOnly: false,
    });
  }

  db.meta.updatedAt = nowIso();
  await dbInstance.write();
}

export async function getDb() {
  const db = await initializeDb();
  return db.data;
}

// ============ Decoupled Background MongoDB Sync ============
let isSyncing = false;
let needsSync = false;
let lastSyncTime = 0;
const SYNC_INTERVAL_MS = 5000; // Throttle: Sync at most once every 5 seconds under load
let bgSyncTimeoutId = null;

function triggerBgSync() {
  needsSync = true;
  if (isSyncing) return;

  if (bgSyncTimeoutId) {
    clearTimeout(bgSyncTimeoutId);
    bgSyncTimeoutId = null;
  }

  const now = Date.now();
  const timeSinceLast = now - lastSyncTime;
  if (timeSinceLast < SYNC_INTERVAL_MS) {
    const delay = SYNC_INTERVAL_MS - timeSinceLast;
    bgSyncTimeoutId = setTimeout(performBgSync, delay);
  } else {
    performBgSync();
  }
}

async function performBgSync() {
  if (isSyncing) return;
  isSyncing = true;
  needsSync = false;
  bgSyncTimeoutId = null;

  try {
    console.log("[DB] ☁️ Starting background MongoDB Atlas sync...");
    // Deep clone database state in memory to prevent mutation race conditions
    const dataToSave = JSON.parse(JSON.stringify(dbInstance.data));
    await saveToMongo(dataToSave);
    lastSyncTime = Date.now();
    console.log("[DB] ☁️ Background MongoDB Atlas sync completed successfully.");
  } catch (err) {
    console.error("[DB] ❌ Background MongoDB Atlas sync failed:", err.message);
    needsSync = true; // Retry on next save or periodic interval
  } finally {
    isSyncing = false;
    if (needsSync) {
      // Schedule a retry
      if (bgSyncTimeoutId) clearTimeout(bgSyncTimeoutId);
      bgSyncTimeoutId = setTimeout(performBgSync, SYNC_INTERVAL_MS);
    }
  }
}

export async function saveDb() {
  if (!dbInstance) {
    await initializeDb();
  }
  dbInstance.data.meta.updatedAt = nowIso();
  
  try {
    // Write locally to JSON file immediately (extremely fast disk write)
    await dbInstance.write();
    
    // Trigger background sync to MongoDB Atlas (non-blocking)
    triggerBgSync();
  } catch (error) {
    console.error("Local database write failed:", error);
    throw error;
  }
}

export async function getRawDbPath() {
  await initializeDb();
  return dataPath;
}
