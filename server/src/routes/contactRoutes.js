import { Router } from "express";
import { nanoid } from "nanoid";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate, csrfProtect } from "../middleware/auth.js";
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
    const query = String(req.query.query || "").toLowerCase().trim();

    const contacts = db.contacts
      .filter((entry) => {
        if (!query) {
          return true;
        }

        return [entry.name, entry.phone, entry.address, entry.notes]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json({ contacts });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const db = await getDb();

    const contact = {
      id: nanoid(),
      name: requireText(req.body.name, "Client name"),
      phone: asOptionalText(req.body.phone),
      address: asOptionalText(req.body.address),
      notes: asOptionalText(req.body.notes),
      purchaseHistory: Array.isArray(req.body.purchaseHistory) ? req.body.purchaseHistory : [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    db.contacts.push(contact);
    await saveDb();

    await addLog({
      action: "create",
      module: "contacts",
      user: req.user,
      details: `Added contact ${contact.name}`,
      ip: req.ip,
    });

    res.status(201).json({ contact });
  }),
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const contact = db.contacts.find((entry) => entry.id === req.params.id);

    if (!contact) {
      return res.status(404).json({ error: "Contact not found." });
    }

    if (req.body.name !== undefined) {
      contact.name = requireText(req.body.name, "Client name");
    }

    if (req.body.phone !== undefined) {
      contact.phone = asOptionalText(req.body.phone);
    }

    if (req.body.address !== undefined) {
      contact.address = asOptionalText(req.body.address);
    }

    if (req.body.notes !== undefined) {
      contact.notes = asOptionalText(req.body.notes);
    }

    contact.updatedAt = nowIso();
    await saveDb();

    await addLog({
      action: "update",
      module: "contacts",
      user: req.user,
      details: `Updated contact ${contact.name}`,
      ip: req.ip,
    });

    res.json({ contact });
  }),
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Only admin can delete contacts." });
    }

    const db = await getDb();
    const index = db.contacts.findIndex((entry) => entry.id === req.params.id);

    if (index < 0) {
      return res.status(404).json({ error: "Contact not found." });
    }

    const [deleted] = db.contacts.splice(index, 1);
    await saveDb();

    await addLog({
      action: "delete",
      module: "contacts",
      user: req.user,
      details: `Deleted contact ${deleted.name}`,
      ip: req.ip,
    });

    res.json({ success: true });
  }),
);

export default router;
