import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate, authorize, csrfProtect } from "../middleware/auth.js";
import { getDb } from "../data/db.js";
import {
  buildAgentProductDraft,
  buildAgentShippingDraft,
  buildAgentSupportReply,
} from "../services/operationsAgentService.js";

const router = Router();

router.use(authenticate, csrfProtect, authorize("admin"));

function getAgentSettings(db) {
  return db.storeSettings?.agentSettings || {};
}

router.post(
  "/products/draft",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const settings = getAgentSettings(db);
    if (settings.productDraftEnabled === false) {
      return res.status(403).json({ error: "Product agent is disabled in settings." });
    }

    const draft = buildAgentProductDraft(req.body || {}, settings);
    res.json({ draft });
  }),
);

router.post(
  "/support/tickets/:id/reply-draft",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const settings = getAgentSettings(db);
    if (settings.supportReplyEnabled === false) {
      return res.status(403).json({ error: "Support agent is disabled in settings." });
    }

    const ticket = db.supportTickets.find((entry) => entry.id === req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found." });
    }

    const linkedOrder = ticket.orderNumber
      ? db.onlineOrders.find((entry) => entry.orderNumber === ticket.orderNumber)
      : null;

    const suggestion = buildAgentSupportReply({ ticket, linkedOrder, settings });
    res.json({ suggestion });
  }),
);

router.post(
  "/orders/:id/shipping-draft",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const settings = getAgentSettings(db);
    if (settings.shippingAgentEnabled === false) {
      return res.status(403).json({ error: "Shipping agent is disabled in settings." });
    }

    const order = db.onlineOrders.find((entry) => entry.id === req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Online order not found." });
    }

    const draft = buildAgentShippingDraft(order, settings);
    res.json({ draft });
  }),
);

export default router;
