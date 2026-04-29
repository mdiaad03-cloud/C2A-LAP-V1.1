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

function normalizeAgentSettings(value, currentSettings = {}) {
  const payload = value && typeof value === "object" ? value : {};
  return {
    productDraftEnabled: payload.productDraftEnabled !== undefined
      ? Boolean(payload.productDraftEnabled)
      : currentSettings.productDraftEnabled !== false,
    supportReplyEnabled: payload.supportReplyEnabled !== undefined
      ? Boolean(payload.supportReplyEnabled)
      : currentSettings.supportReplyEnabled !== false,
    shippingAgentEnabled: payload.shippingAgentEnabled !== undefined
      ? Boolean(payload.shippingAgentEnabled)
      : currentSettings.shippingAgentEnabled !== false,
    autoMoveTicketsToInProgress: payload.autoMoveTicketsToInProgress !== undefined
      ? Boolean(payload.autoMoveTicketsToInProgress)
      : currentSettings.autoMoveTicketsToInProgress !== false,
    defaultShippingCompanyName:
      asOptionalText(payload.defaultShippingCompanyName)
      || asOptionalText(currentSettings.defaultShippingCompanyName)
      || "C2A LAP Delivery",
    defaultShippingStatus:
      asOptionalText(payload.defaultShippingStatus)
      || asOptionalText(currentSettings.defaultShippingStatus)
      || "in_transit",
    productDescriptionTone:
      asOptionalText(payload.productDescriptionTone)
      || asOptionalText(currentSettings.productDescriptionTone)
      || "professional",
    supportReplyTone:
      asOptionalText(payload.supportReplyTone)
      || asOptionalText(currentSettings.supportReplyTone)
      || "friendly",
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

    if (req.body.socialLinks !== undefined) {
      db.storeSettings.socialLinks = normalizeSocialLinks(req.body.socialLinks);
    }

    if (req.body.agentSettings !== undefined) {
      db.storeSettings.agentSettings = normalizeAgentSettings(
        req.body.agentSettings,
        db.storeSettings.agentSettings || {},
      );
    }

    await saveDb();

    await addLog({
      action: "update",
      module: "store-settings",
      user: req.user,
      details: "Updated online store settings",
      ip: req.ip,
    });

    res.json({ storeSettings: db.storeSettings });
  }),
);

export default router;
