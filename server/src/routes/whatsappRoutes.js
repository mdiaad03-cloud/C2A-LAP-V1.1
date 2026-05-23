import { Router } from "express";
import { getDb, saveDb } from "../data/db.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { receiveCustomerReply, sendWhatsAppMessage } from "../services/whatsappService.js";
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

export default router;
