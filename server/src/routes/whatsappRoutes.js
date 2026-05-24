import { Router } from "express";
import { getDb, saveDb } from "../data/db.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { receiveCustomerReply, sendWhatsAppMessage, DEFAULT_TEMPLATES } from "../services/whatsappService.js";
import {
  ORDER_STATUSES,
  buildOrderStatusHistory,
  createSalesFromOnlineOrder,
  ensureOnlineEmployee,
} from "../services/onlineOrderService.js";
import { syncSalesWorkbook } from "../services/excelAutoSaveService.js";
import { nowIso } from "../utils/dateUtils.js";
import { nanoid } from "nanoid";

const router = Router();

async function syncSalesExcelSafe(sales) {
  try {
    await syncSalesWorkbook(sales);
  } catch (error) {
    console.error("WhatsApp Route sync sales excel failed:", error);
  }
}

// 1. GET /api/whatsapp/logs (Admin & Employee view)
router.get(
  "/logs",
  authenticate,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const logs = db.whatsappLogs || [];
    res.json({ logs });
  }),
);

// GET /api/whatsapp/config (Admin diagnostic view)
router.get(
  "/config",
  authenticate,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const { env } = await import("../config/env.js");
    const { default: axios } = await import("axios");
    
    let ultramsgStatus = "unknown";
    if (env.ultramsgInstanceId && env.ultramsgToken) {
      try {
        const response = await axios.get(
          `https://api.ultramsg.com/${env.ultramsgInstanceId}/instance/settings`,
          {
            params: { token: env.ultramsgToken },
            timeout: 10000,
          }
        );
        ultramsgStatus = {
          webhook_url: response.data?.webhook_url,
          webhook_message_received: response.data?.webhook_message_received,
          webhook_message_create: response.data?.webhook_message_create,
          webhook_message_ack: response.data?.webhook_message_ack,
        };
      } catch (err) {
        ultramsgStatus = { error: err.response?.data || err.message };
      }
    }
    
    res.json({
      storeBaseUrl: env.storeBaseUrl,
      ultramsgInstanceId: env.ultramsgInstanceId,
      hasToken: Boolean(env.ultramsgToken),
      ultramsgSettings: ultramsgStatus,
    });
  }),
);

// 2. POST /api/whatsapp/simulate-reply (Simulate customer replying to the WhatsApp bot)
router.post(
  "/simulate-reply",
  authenticate,
  asyncHandler(async (req, res) => {
    const { phone, text } = req.body;
    if (!phone || !text) {
      return res.status(400).json({ error: "Phone number and text are required." });
    }

    const result = await receiveCustomerReply(phone, text);
    res.json({ success: true, ...result });
  }),
);

// 3. POST /api/whatsapp/confirm-link/:id (Public endpoint for clicking link sent on WhatsApp)
router.post(
  "/confirm-link/:id",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const order = db.onlineOrders.find((o) => o.id === req.params.id);

    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    if (order.status !== ORDER_STATUSES.pending) {
      return res.json({
        success: true,
        alreadyConfirmed: true,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          customerName: order.customerName,
        },
      });
    }

    // Confirm the order
    order.status = ORDER_STATUSES.confirmed;
    order.statusHistory = order.statusHistory || [];
    order.statusHistory.unshift(
      buildOrderStatusHistory(ORDER_STATUSES.confirmed, { id: "whatsapp_link", name: "WhatsApp Link Confirmation" })
    );

    const onlineEmployee = await ensureOnlineEmployee(db);
    order.assignedEmployeeId = onlineEmployee.id;
    order.assignedEmployeeName = onlineEmployee.name;

    let salesChanged = false;
    if (!Array.isArray(order.saleIds) || order.saleIds.length === 0) {
      const salesEntries = createSalesFromOnlineOrder(db, order, onlineEmployee);
      order.saleIds = salesEntries.map((entry) => entry.id);
      salesChanged = salesEntries.length > 0;
    }
    order.confirmedAt = order.confirmedAt || nowIso();
    order.updatedAt = nowIso();

    db.notifications.unshift({
      id: nanoid(),
      title: `Order ${order.orderNumber} confirmed via Web Link`,
      message: `Customer ${order.customerName} confirmed their order by clicking the WhatsApp confirmation link.`,
      createdAt: nowIso(),
      createdBy: "whatsapp_link",
      createdByName: "WhatsApp Link",
    });
    db.notifications = db.notifications.slice(0, 200);

    // Send a WhatsApp follow-up confirmation message to notify the customer their link click worked
    const followUpText = `تمت عملية تأكيد طلبك رقم ${order.orderNumber} بنجاح عبر الرابط! 🎉 سنقوم بشحنه إليك قريباً. شكراً لك!`;
    await sendWhatsAppMessage(order.customerPhone, followUpText, order.id);

    // Notify Admin Alert
    try {
      const { sendWhatsAppAdminAlert } = await import("../services/whatsappService.js");
      const adminAlertText = `✅ *تم تأكيد الطلب من العميل عبر رابط الويب*
📋 طلب رقم: *${order.orderNumber}*
👤 العميل: *${order.customerName}*
📞 هاتف: *${order.customerPhone}*
💰 الإجمالي: *${Number(order.total).toLocaleString("ar-EG")} ج.م*`;
      await sendWhatsAppAdminAlert(adminAlertText);
    } catch (adminAlertErr) {
      console.error("WhatsApp Link Confirmation Admin Alert failed:", adminAlertErr);
    }

    await saveDb();
    if (salesChanged) {
      await syncSalesExcelSafe(db.sales);
    }

    res.json({
      success: true,
      alreadyConfirmed: false,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        customerName: order.customerName,
      },
    });
  }),
);

// 4. POST /api/whatsapp/webhook (UltraMsg incoming message webhook)
router.post(
  "/webhook",
  asyncHandler(async (req, res) => {
    const data = req.body || {};
    const eventType = data.event_type || data.type || "";
    
    // Only process incoming messages
    if (eventType && eventType !== "message_received" && eventType !== "chat") {
      return res.json({ success: true, skipped: true });
    }

    // Extract phone and message body from UltraMsg webhook payload
    const phone = data.data?.from || data.from || data.phone || "";
    const text = data.data?.body || data.body || data.text || data.message || "";

    if (!phone || !text) {
      return res.json({ success: true, skipped: true, reason: "no phone or text" });
    }

    // Clean the phone
    const cleanedPhone = String(phone).replace(/@c\.us$/, "").replace(/@s\.whatsapp\.net$/, "");

    console.log(`[UltraMsg Webhook] Received from ${cleanedPhone}: "${text}"`);

    try {
      const result = await receiveCustomerReply(cleanedPhone, text.trim());
      console.log(`[UltraMsg Webhook] Processed reply for ${cleanedPhone}`);
      res.json({ success: true, ...result });
    } catch (err) {
      console.error(`[UltraMsg Webhook] Error processing reply:`, err.message);
      res.json({ success: false, error: err.message });
    }
  }),
);

// 5. GET /api/whatsapp/webhook (UltraMsg verification endpoint)
router.get(
  "/webhook",
  (req, res) => {
    res.status(200).send("OK");
  },
);

// 6. GET /api/whatsapp/templates (Admin/Employee view current templates)
router.get(
  "/templates",
  authenticate,
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const dbTemplates = db.whatsappTemplates || {};
    const templates = {
      ...DEFAULT_TEMPLATES,
      ...dbTemplates,
    };
    res.json({ templates });
  })
);

// 7. POST /api/whatsapp/templates (Admin only - save updated templates)
router.post(
  "/templates",
  authenticate,
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const { templates } = req.body;
    if (!templates || typeof templates !== "object") {
      return res.status(400).json({ error: "Templates object is required." });
    }

    const db = await getDb();
    db.whatsappTemplates = {
      ...(db.whatsappTemplates || {}),
      ...templates,
    };
    await saveDb();

    res.json({ success: true, templates: db.whatsappTemplates });
  })
);

export default router;
