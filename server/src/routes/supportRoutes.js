import { Router } from "express";
import { nanoid } from "nanoid";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate, authenticateOptional, authorize } from "../middleware/auth.js";
import { getDb, saveDb } from "../data/db.js";
import { addLog } from "../services/logService.js";
import { sendSupportTicketReceivedEmail } from "../services/emailService.js";
import { nowIso } from "../utils/dateUtils.js";
import {
  asOptionalText,
  requireEmail,
  requireText,
  sanitizeText,
} from "../utils/validation.js";

const router = Router();

const statusList = ["open", "in_progress", "resolved", "closed"];

function buildCustomerIdentity(req, body) {
  if (req.user?.role === "customer") {
    return {
      customerId: req.user.id,
      customerName: sanitizeText(req.user.name || "Customer"),
      customerEmail: asOptionalText(body.email || req.user.email),
      customerPhone: asOptionalText(body.phone || req.user.phone),
    };
  }

  const customerName = requireText(body.name, "Name");
  const customerEmail = requireEmail(body.email, "Email");
  const customerPhone = asOptionalText(body.phone);
  return {
    customerId: "",
    customerName,
    customerEmail,
    customerPhone,
  };
}

router.post(
  "/tickets",
  authenticateOptional,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const identity = buildCustomerIdentity(req, req.body || {});

    const ticket = {
      id: nanoid(),
      customerId: identity.customerId,
      customerName: identity.customerName,
      customerEmail: identity.customerEmail,
      customerPhone: identity.customerPhone,
      orderNumber: asOptionalText(req.body.orderNumber),
      subject: requireText(req.body.subject, "Subject"),
      status: "open",
      priority: asOptionalText(req.body.priority || "normal"),
      messages: [
        {
          id: nanoid(),
          senderRole: req.user?.role === "customer" ? "customer" : "guest",
          senderName: identity.customerName,
          body: requireText(req.body.message, "Message"),
          createdAt: nowIso(),
        },
      ],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastReplyAt: nowIso(),
      assignedToId: "",
      assignedToName: "",
    };

    db.supportTickets.unshift(ticket);
    db.supportTickets = db.supportTickets.slice(0, 10000);
    await saveDb();

    await addLog({
      action: "create",
      module: "support",
      user: req.user || { id: "guest", username: "guest" },
      details: `Created support ticket ${ticket.id}`,
      ip: req.ip,
    });

    try {
      await sendSupportTicketReceivedEmail({ ticket });
    } catch (mailError) {
      console.error(`Support ticket email failed for ${ticket.id}:`, mailError);
    }

    res.status(201).json({ ticket });
  }),
);

router.get(
  "/tickets",
  authenticate,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    let tickets = db.supportTickets || [];

    if (req.user.role === "customer") {
      tickets = tickets.filter((ticket) => ticket.customerId === req.user.id);
    } else if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized to view support tickets." });
    }

    const query = String(req.query.query || "").trim().toLowerCase();
    const status = String(req.query.status || "").trim().toLowerCase();
    if (status && statusList.includes(status)) {
      tickets = tickets.filter((ticket) => ticket.status === status);
    }
    if (query) {
      tickets = tickets.filter((ticket) =>
        [
          ticket.subject,
          ticket.customerName,
          ticket.customerEmail,
          ticket.orderNumber,
          ticket.id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query),
      );
    }

    tickets = tickets.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json({
      tickets: tickets.slice(0, 500),
      stats: {
        total: tickets.length,
        open: tickets.filter((ticket) => ticket.status === "open").length,
        inProgress: tickets.filter((ticket) => ticket.status === "in_progress").length,
        resolved: tickets.filter((ticket) => ticket.status === "resolved").length,
      },
    });
  }),
);

router.post(
  "/tickets/:id/messages",
  authenticate,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const ticket = db.supportTickets.find((entry) => entry.id === req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found." });
    }

    if (req.user.role === "customer" && ticket.customerId !== req.user.id) {
      return res.status(403).json({ error: "Cannot reply to this ticket." });
    }
    if (!["admin", "customer"].includes(req.user.role)) {
      return res.status(403).json({ error: "Unauthorized role." });
    }

    ticket.messages.unshift({
      id: nanoid(),
      senderRole: req.user.role,
      senderName: req.user.name,
      body: requireText(req.body.message, "Message"),
      createdAt: nowIso(),
    });
    ticket.updatedAt = nowIso();
    ticket.lastReplyAt = nowIso();
    if (req.user.role === "admin" && ticket.status === "open") {
      ticket.status = "in_progress";
    }
    await saveDb();

    res.status(201).json({ ticket });
  }),
);

router.put(
  "/tickets/:id",
  authenticate,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const ticket = db.supportTickets.find((entry) => entry.id === req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found." });
    }

    if (req.body.status !== undefined) {
      const status = asOptionalText(req.body.status).toLowerCase();
      if (!statusList.includes(status)) {
        return res.status(400).json({ error: "Invalid ticket status." });
      }
      ticket.status = status;
    }

    if (req.body.assignedToId !== undefined) {
      const assignedUser = db.users.find(
        (entry) => entry.id === req.body.assignedToId && ["admin", "sales"].includes(entry.role),
      );
      if (assignedUser) {
        ticket.assignedToId = assignedUser.id;
        ticket.assignedToName = assignedUser.name;
      }
    }

    if (req.body.reply !== undefined) {
      ticket.messages.unshift({
        id: nanoid(),
        senderRole: "admin",
        senderName: req.user.name,
        body: requireText(req.body.reply, "Reply"),
        createdAt: nowIso(),
      });
      ticket.lastReplyAt = nowIso();
    }

    ticket.updatedAt = nowIso();
    await saveDb();

    await addLog({
      action: "update",
      module: "support",
      user: req.user,
      details: `Updated support ticket ${ticket.id}`,
      ip: req.ip,
    });

    res.json({ ticket });
  }),
);

export default router;
