import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate, authorize, csrfProtect } from "../middleware/auth.js";
import { getDb, saveDb } from "../data/db.js";
import { addLog } from "../services/logService.js";
import { asOptionalText } from "../utils/validation.js";

const router = Router();

router.use(authenticate, authorize("admin"), csrfProtect);

function normalizeCategories(value) {
  if (Array.isArray(value)) {
    return value.map((item) => asOptionalText(item)).filter(Boolean).slice(0, 30);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => asOptionalText(item))
      .filter(Boolean)
      .slice(0, 30);
  }
  return [];
}

function normalizeFaqItems(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => ({
      id: asOptionalText(item?.id) || String(index + 1).padStart(2, "0"),
      question: asOptionalText(item?.question),
      questionAr: asOptionalText(item?.questionAr),
      answer: asOptionalText(item?.answer),
      answerAr: asOptionalText(item?.answerAr),
    }))
    .filter((item) => item.question && item.answer)
    .slice(0, 8);
}

function normalizeSocialLinks(value) {
  const payload = value && typeof value === "object" ? value : {};
  return {
    whatsapp: {
      enabled: Boolean(payload.whatsapp?.enabled),
      url: asOptionalText(payload.whatsapp?.url),
    },
    facebook: {
      enabled: Boolean(payload.facebook?.enabled),
      url: asOptionalText(payload.facebook?.url),
    },
    instagram: {
      enabled: Boolean(payload.instagram?.enabled),
      url: asOptionalText(payload.instagram?.url),
    },
    tiktok: {
      enabled: Boolean(payload.tiktok?.enabled),
      url: asOptionalText(payload.tiktok?.url),
    },
  };
}

function normalizeAgentSettings(value) {
  const payload = value && typeof value === "object" ? value : {};
  return {
    productDraftEnabled: payload.productDraftEnabled !== false,
    supportReplyEnabled: payload.supportReplyEnabled !== false,
    shippingAgentEnabled: payload.shippingAgentEnabled !== false,
    excelImportEnabled: payload.excelImportEnabled !== false,
    autoMoveTicketsToInProgress: payload.autoMoveTicketsToInProgress !== false,
    defaultShippingCompanyName: asOptionalText(payload.defaultShippingCompanyName) || "Bosta",
    defaultShippingStatus: asOptionalText(payload.defaultShippingStatus) || "pickup_requested",
    productDescriptionTone: asOptionalText(payload.productDescriptionTone) || "professional",
    supportReplyTone: asOptionalText(payload.supportReplyTone) || "friendly",
    defaultWarrantyMonths: Math.max(1, Number(payload.defaultWarrantyMonths) || 12),
    priceMarkupEnabled: payload.priceMarkupEnabled === true,
    priceMarkupType: String(payload.priceMarkupType || "fixed").toLowerCase() === "percent" ? "percent" : "fixed",
    priceMarkupValue: Math.max(0, Number(payload.priceMarkupValue) || 0),
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    res.json({ storeSettings: db.storeSettings || {} });
  }),
);

router.put(
  "/",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    db.storeSettings ||= {};

    if (req.body.shippingFlatRate !== undefined) {
      db.storeSettings.shippingFlatRate = Math.max(0, Number(req.body.shippingFlatRate || 0));
    }
    if (req.body.freeShippingThreshold !== undefined) {
      db.storeSettings.freeShippingThreshold = Math.max(0, Number(req.body.freeShippingThreshold || 0));
    }
    if (req.body.lowStockThreshold !== undefined) {
      db.storeSettings.lowStockThreshold = Math.max(1, Number.parseInt(req.body.lowStockThreshold, 10) || 3);
    }
    if (req.body.maxCouponsPerOrder !== undefined) {
      db.storeSettings.maxCouponsPerOrder = Math.max(1, Number.parseInt(req.body.maxCouponsPerOrder, 10) || 1);
    }
    if (req.body.categories !== undefined) {
      db.storeSettings.categories = normalizeCategories(req.body.categories);
    }

    db.storeSettings.content ||= {};
    const contentPayload = req.body.content || {};
    const contentFields = [
      "heroBadge",
      "heroBadgeAr",
      "heroTitle",
      "heroTitleAr",
      "heroSubtitle",
      "heroSubtitleAr",
      "primaryCtaLabel",
      "primaryCtaLabelAr",
      "secondaryCtaLabel",
      "secondaryCtaLabelAr",
      "featuredTitle",
      "featuredTitleAr",
      "offersTitle",
      "offersTitleAr",
      "offersSubtitle",
      "offersSubtitleAr",
      "brandsTitle",
      "brandsTitleAr",
      "faqTitle",
      "faqTitleAr",
      "faqSubtitle",
      "faqSubtitleAr",
    ];
    for (const field of contentFields) {
      if (contentPayload[field] !== undefined) {
        db.storeSettings.content[field] = asOptionalText(contentPayload[field]);
      }
    }
    if (contentPayload.faqItems !== undefined) {
      db.storeSettings.content.faqItems = normalizeFaqItems(contentPayload.faqItems);
    }

    db.storeSettings.features ||= {};
    const featuresPayload = req.body.features || {};
    if (featuresPayload.reviewsEnabled !== undefined) {
      db.storeSettings.features.reviewsEnabled = Boolean(featuresPayload.reviewsEnabled);
    }
    if (featuresPayload.paymobEnabled !== undefined) {
      db.storeSettings.features.paymobEnabled = Boolean(featuresPayload.paymobEnabled);
    }
    if (featuresPayload.paymobComingSoon !== undefined) {
      db.storeSettings.features.paymobComingSoon = Boolean(featuresPayload.paymobComingSoon);
    }
    if (featuresPayload.instapayEnabled !== undefined) {
      db.storeSettings.features.instapayEnabled = Boolean(featuresPayload.instapayEnabled);
    }
    if (featuresPayload.instapayComingSoon !== undefined) {
      db.storeSettings.features.instapayComingSoon = Boolean(featuresPayload.instapayComingSoon);
    }
    if (featuresPayload.cashOnDeliveryEnabled !== undefined) {
      db.storeSettings.features.cashOnDeliveryEnabled = Boolean(featuresPayload.cashOnDeliveryEnabled);
    }
    if (featuresPayload.instapayAddress !== undefined) {
      db.storeSettings.features.instapayAddress = asOptionalText(featuresPayload.instapayAddress);
    }
    if (featuresPayload.instapayLink !== undefined) {
      db.storeSettings.features.instapayLink = asOptionalText(featuresPayload.instapayLink);
    }

    if (req.body.socialLinks !== undefined) {
      db.storeSettings.socialLinks = normalizeSocialLinks(req.body.socialLinks);
    }
    if (req.body.agentSettings !== undefined) {
      db.storeSettings.agentSettings = normalizeAgentSettings(req.body.agentSettings);
    }

    // Recalculate and update all product selling prices based on the new markup settings
    const agentSettings = db.storeSettings.agentSettings || {};
    if (Array.isArray(db.products)) {
      const nowIsoStr = new Date().toISOString();
      for (const product of db.products) {
        const purchasePrice = Number(product.purchasePrice || 0);
        if (purchasePrice > 0) {
          let nextSellingPrice = purchasePrice;
          if (agentSettings.priceMarkupEnabled) {
            const markupVal = Number(agentSettings.priceMarkupValue) || 0;
            if (agentSettings.priceMarkupType === "percent") {
              nextSellingPrice = purchasePrice * (1 + markupVal / 100);
            } else {
              nextSellingPrice = purchasePrice + markupVal;
            }
          }
          product.sellingPrice = Number(nextSellingPrice.toFixed(2));
          product.price = product.sellingPrice; // Keep both in sync
          product.updatedAt = nowIsoStr;
        }
      }
    }

    await saveDb();

    await addLog({
      action: "update",
      module: "store-settings",
      user: req.user,
      details: "Updated online store settings",
      ip: req.ip,
    });

    res.json({
      success: true,
      message: "Store settings updated successfully.",
      storeSettings: db.storeSettings,
    });
  }),
);

export default router;
