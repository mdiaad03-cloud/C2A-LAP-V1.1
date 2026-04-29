import { Router } from "express";
import { nanoid } from "nanoid";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate, authorize, csrfProtect } from "../middleware/auth.js";
import { getDb, saveDb } from "../data/db.js";
import { addLog } from "../services/logService.js";
import { nowIso } from "../utils/dateUtils.js";
import { asOptionalText, requireText } from "../utils/validation.js";

const router = Router();

router.use(authenticate, csrfProtect);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    res.json({ shippingCompanies: db.shippingCompanies });
  }),
);

router.post(
  "/",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const db = await getDb();

    const shippingCompany = {
      id: nanoid(),
      name: requireText(req.body.name, "Shipping company name"),
      phone: asOptionalText(req.body.phone),
      notes: asOptionalText(req.body.notes),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    db.shippingCompanies.push(shippingCompany);
    await saveDb();

    await addLog({
      action: "create",
      module: "shipping",
      user: req.user,
      details: `Added shipping company ${shippingCompany.name}`,
      ip: req.ip,
    });

    res.status(201).json({ shippingCompany });
  }),
);

router.put(
  "/:id",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const company = db.shippingCompanies.find((entry) => entry.id === req.params.id);

    if (!company) {
      return res.status(404).json({ error: "Shipping company not found." });
    }

    if (req.body.name !== undefined) {
      company.name = requireText(req.body.name, "Shipping company name");
    }

    if (req.body.phone !== undefined) {
      company.phone = asOptionalText(req.body.phone);
    }

    if (req.body.notes !== undefined) {
      company.notes = asOptionalText(req.body.notes);
    }

    company.updatedAt = nowIso();
    await saveDb();

    await addLog({
      action: "update",
      module: "shipping",
      user: req.user,
      details: `Updated shipping company ${company.name}`,
      ip: req.ip,
    });

    res.json({ shippingCompany: company });
  }),
);

router.delete(
  "/:id",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const index = db.shippingCompanies.findIndex((entry) => entry.id === req.params.id);

    if (index < 0) {
      return res.status(404).json({ error: "Shipping company not found." });
    }

    const [deleted] = db.shippingCompanies.splice(index, 1);
    await saveDb();

    await addLog({
      action: "delete",
      module: "shipping",
      user: req.user,
      details: `Deleted shipping company ${deleted.name}`,
      ip: req.ip,
    });

    res.json({ success: true });
  }),
);

export default router;
