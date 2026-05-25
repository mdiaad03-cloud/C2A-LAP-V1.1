import { Router } from "express";
import { nanoid } from "nanoid";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate, authorize, csrfProtect } from "../middleware/auth.js";
import { getDb, saveDb } from "../data/db.js";
import { addLog } from "../services/logService.js";
import { nowIso } from "../utils/dateUtils.js";
import { requireText } from "../utils/validation.js";

const router = Router();

// Require authenticate and csrfProtect for all routes
router.use(authenticate, csrfProtect);

router.get(
  "/",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    res.json({ coupons: db.coupons || [] });
  })
);

router.post(
  "/",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const code = requireText(req.body.code, "Coupon code").trim().toUpperCase();
    const type = requireText(req.body.type, "Discount type").trim().toLowerCase();

    if (!["percent", "fixed", "free_shipping"].includes(type)) {
      return res.status(400).json({ error: "Invalid discount type." });
    }

    const value = type === "free_shipping" ? 0 : Number(req.body.value) || 0;
    if (type !== "free_shipping" && value <= 0) {
      return res.status(400).json({ error: "Discount value must be positive." });
    }

    const usageLimit = Math.max(0, Number(req.body.usageLimit) || 0);
    const productId = req.body.productId ? String(req.body.productId).trim() : "";

    if (productId) {
      const productExists = db.products?.some((p) => p.id === productId);
      if (!productExists) {
        return res.status(400).json({ error: "Selected product does not exist in the catalog." });
      }
    }

    db.coupons ||= [];
    const exists = db.coupons.find((c) => c.code.toUpperCase() === code);
    if (exists) {
      return res.status(409).json({ error: "A coupon with this code already exists." });
    }

    const coupon = {
      id: nanoid(),
      code,
      type,
      value,
      usageLimit,
      productId,
      usageCount: 0,
      isActive: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    db.coupons.push(coupon);
    await saveDb();

    await addLog({
      action: "create",
      module: "coupons",
      user: req.user,
      details: `Created coupon ${code} (${type}: ${value})`,
      ip: req.ip,
    });

    res.status(201).json({ coupon });
  })
);

router.put(
  "/:id",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    db.coupons ||= [];
    const coupon = db.coupons.find((c) => c.id === req.params.id);
    if (!coupon) {
      return res.status(404).json({ error: "Coupon not found." });
    }

    if (req.body.code !== undefined) {
      const code = requireText(req.body.code, "Coupon code").trim().toUpperCase();
      const duplicate = db.coupons.find((c) => c.code.toUpperCase() === code && c.id !== coupon.id);
      if (duplicate) {
        return res.status(409).json({ error: "A coupon with this code already exists." });
      }
      coupon.code = code;
    }

    if (req.body.type !== undefined) {
      const type = requireText(req.body.type, "Discount type").trim().toLowerCase();
      if (!["percent", "fixed", "free_shipping"].includes(type)) {
        return res.status(400).json({ error: "Invalid discount type." });
      }
      coupon.type = type;
    }

    if (req.body.value !== undefined) {
      const value = Number(req.body.value) || 0;
      if (coupon.type !== "free_shipping" && value <= 0) {
        return res.status(400).json({ error: "Discount value must be positive." });
      }
      coupon.value = coupon.type === "free_shipping" ? 0 : value;
    }

    if (req.body.usageLimit !== undefined) {
      coupon.usageLimit = Math.max(0, Number(req.body.usageLimit) || 0);
    }

    if (req.body.productId !== undefined) {
      const productId = String(req.body.productId || "").trim();
      if (productId) {
        const productExists = db.products?.some((p) => p.id === productId);
        if (!productExists) {
          return res.status(400).json({ error: "Selected product does not exist in the catalog." });
        }
      }
      coupon.productId = productId;
    }

    if (req.body.isActive !== undefined) {
      coupon.isActive = Boolean(req.body.isActive);
    }

    coupon.updatedAt = nowIso();
    await saveDb();

    await addLog({
      action: "update",
      module: "coupons",
      user: req.user,
      details: `Updated coupon ${coupon.code}`,
      ip: req.ip,
    });

    res.json({ coupon });
  })
);

router.delete(
  "/:id",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    db.coupons ||= [];
    const index = db.coupons.findIndex((c) => c.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: "Coupon not found." });
    }

    const [deleted] = db.coupons.splice(index, 1);
    await saveDb();

    await addLog({
      action: "delete",
      module: "coupons",
      user: req.user,
      details: `Deleted coupon ${deleted.code}`,
      ip: req.ip,
    });

    res.json({ success: true });
  })
);

export default router;
