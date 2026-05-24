import { getDb, saveDb } from "../data/db.js";
import { nowIso } from "../utils/dateUtils.js";
import { nanoid } from "nanoid";
import {
  ORDER_STATUSES,
  buildOrderStatusHistory,
  restoreOrderStock,
  removeOnlineOrderSales,
} from "./onlineOrderService.js";
import { sendOrderStatusMessage } from "./whatsappService.js";
import { sendOrderStatusEmail } from "./emailService.js";

const CANCEL_AFTER_HOURS = 24;
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // Check every 30 minutes

async function autoCancelExpiredOrders() {
  try {
    const db = await getDb();
    const now = new Date();
    const expiredOrders = (db.onlineOrders || []).filter((order) => {
      if (String(order.status || "").toLowerCase() !== "pending") return false;
      // Only auto-cancel cash_on_delivery orders
      const method = String(order.paymentMethod || "").toLowerCase();
      if (method === "paymob" || method === "paymob_egypt") return false;
      const createdAt = new Date(order.createdAt || 0);
      const hoursSince = (now - createdAt) / (1000 * 60 * 60);
      return hoursSince > CANCEL_AFTER_HOURS;
    });

    if (expiredOrders.length === 0) return;

    console.log(`[Auto-Cancel] Found ${expiredOrders.length} expired pending order(s)...`);

    for (const order of expiredOrders) {
      const previousStatus = order.status;

      order.status = ORDER_STATUSES.cancelled || "cancelled";
      order.statusHistory = order.statusHistory || [];
      order.statusHistory.unshift(
        buildOrderStatusHistory(order.status, {
          id: "auto_cancel",
          name: "Auto-Cancel (24h expired)",
        })
      );

      // Restore stock
      if (!order.stockRestoredAt) {
        restoreOrderStock(db, order);
        order.stockRestoredAt = nowIso();
      }

      // Remove sales entries
      removeOnlineOrderSales(db, order);

      order.cancelledAt = nowIso();
      order.cancelledBy = "auto_cancel_24h";
      order.shippingStatus = "cancelled";
      order.updatedAt = nowIso();

      // Add notification for admin
      db.notifications = db.notifications || [];
      db.notifications.unshift({
        id: nanoid(),
        title: `Order ${order.orderNumber} auto-cancelled (24h)`,
        message: `Order ${order.orderNumber} by ${order.customerName} was automatically cancelled — customer did not confirm within 24 hours.`,
        createdAt: nowIso(),
        createdBy: "auto_cancel",
        createdByName: "Auto-Cancel System",
      });
      db.notifications = db.notifications.slice(0, 200);

      console.log(`[Auto-Cancel] Cancelled order ${order.orderNumber} (placed: ${order.createdAt})`);

      // Send cancellation notifications
      try {
        await sendOrderStatusMessage(order, previousStatus);
      } catch (err) {
        console.error(`[Auto-Cancel] WhatsApp notification failed for ${order.orderNumber}:`, err.message);
      }
      try {
        await sendOrderStatusEmail({ order, previousStatus });
      } catch (err) {
        console.error(`[Auto-Cancel] Email notification failed for ${order.orderNumber}:`, err.message);
      }
    }

    await saveDb();
    console.log(`[Auto-Cancel] Done. Cancelled ${expiredOrders.length} order(s).`);
  } catch (error) {
    console.error("[Auto-Cancel] Scheduler error:", error.message);
  }
}

export function scheduleAutoCancelOrders() {
  // Run once immediately on startup
  autoCancelExpiredOrders();
  // Then run every 30 minutes
  setInterval(autoCancelExpiredOrders, CHECK_INTERVAL_MS);
  console.log(`[Auto-Cancel] Scheduler started — checking every ${CHECK_INTERVAL_MS / 60000} minutes for expired pending orders.`);
}
