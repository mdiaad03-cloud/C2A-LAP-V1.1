import { Router } from "express";
import { nanoid } from "nanoid";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate, authorize, csrfProtect } from "../middleware/auth.js";
import { getDb, saveDb } from "../data/db.js";
import { addLog } from "../services/logService.js";
import { sendOrderStatusEmail } from "../services/emailService.js";
import { sendOrderStatusMessage } from "../services/whatsappService.js";
import {
  ORDER_STATUSES,
  buildOnlineOrderAnalytics,
  buildOrderStatusHistory,
  canTransitionStatus,
  createSalesFromOnlineOrder,
  filterOnlineOrders,
  removeOnlineOrderSales,
  resolveAssignedEmployee,
  restoreOrderStock,
  syncOnlineOrderSales,
} from "../services/onlineOrderService.js";
import { syncSalesWorkbook } from "../services/excelAutoSaveService.js";
import { nowIso } from "../utils/dateUtils.js";
import { asOptionalText } from "../utils/validation.js";

const router = Router();

router.use(authenticate, csrfProtect);

async function syncSalesExcelSafe(sales) {
  try {
    await syncSalesWorkbook(sales);
  } catch (error) {
    console.error("Online order sales sync failed:", error);
  }
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const db = await getDb();

    const visibleOrders = req.user.role === "admin"
      ? db.onlineOrders
      : db.onlineOrders.filter((order) => order.assignedEmployeeId === req.user.id);

    const filteredOrders = filterOnlineOrders(visibleOrders, req.query)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const analytics = buildOnlineOrderAnalytics({
      allOrders: visibleOrders,
      filteredOrders,
      products: db.products,
      sales: db.sales,
      lowStockThreshold: Number(db.storeSettings?.lowStockThreshold || 3),
    });

    res.json({
      orders: filteredOrders.slice(0, 700),
      analytics,
    });
  }),
);

router.put(
  "/:id",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const order = db.onlineOrders.find((entry) => entry.id === req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Online order not found." });
    }

    const requestedStatus = String(req.body.status || "").trim().toLowerCase();
    if (requestedStatus && !Object.values(ORDER_STATUSES).includes(requestedStatus)) {
      return res.status(400).json({ error: "Invalid order status." });
    }

    if (requestedStatus && !canTransitionStatus(order.status, requestedStatus)) {
      return res.status(409).json({
        error: `Cannot move order from ${order.status} to ${requestedStatus}.`,
      });
    }

    let assignedEmployee;
    let syncLinkedSalesMetadata = false;
    if (req.body.assignedEmployeeId !== undefined && req.body.assignedEmployeeId !== null) {
      assignedEmployee = await resolveAssignedEmployee(db, asOptionalText(req.body.assignedEmployeeId));
      order.assignedEmployeeId = assignedEmployee.id;
      order.assignedEmployeeName = assignedEmployee.name;
      syncLinkedSalesMetadata = true;
    }

    if (req.body.shippingCompanyName !== undefined) {
      order.shippingCompanyName = asOptionalText(req.body.shippingCompanyName);
      syncLinkedSalesMetadata = true;
    }
    if (req.body.shippingCompanyPhone !== undefined) {
      order.shippingCompanyPhone = asOptionalText(req.body.shippingCompanyPhone);
      syncLinkedSalesMetadata = true;
    }
    if (req.body.trackingNumber !== undefined) {
      order.trackingNumber = asOptionalText(req.body.trackingNumber);
      syncLinkedSalesMetadata = true;
    }
    if (req.body.shippingStatus !== undefined) {
      order.shippingStatus = asOptionalText(req.body.shippingStatus) || order.shippingStatus || "new";
      syncLinkedSalesMetadata = true;
    }
    if (req.body.paymentStatus !== undefined) {
      order.paymentStatus = asOptionalText(req.body.paymentStatus) || order.paymentStatus || "pending_collection";
    }

    let salesChanged = false;
    let previousStatus = "";
    if (requestedStatus && requestedStatus !== order.status) {
      previousStatus = order.status;
      order.status = requestedStatus;
      order.statusHistory ||= [];
      order.statusHistory.unshift(buildOrderStatusHistory(requestedStatus, req.user));

      const needsConfirmation = [ORDER_STATUSES.confirmed, ORDER_STATUSES.shipped, ORDER_STATUSES.delivered].includes(requestedStatus);
      if (needsConfirmation) {
        if (!order.confirmedAt || !Array.isArray(order.saleIds) || order.saleIds.length === 0) {
          assignedEmployee ||= await resolveAssignedEmployee(db, order.assignedEmployeeId);
          order.assignedEmployeeId = assignedEmployee.id;
          order.assignedEmployeeName = assignedEmployee.name;

          if (!Array.isArray(order.saleIds) || order.saleIds.length === 0) {
            const salesEntries = createSalesFromOnlineOrder(db, order, assignedEmployee);
            order.saleIds = salesEntries.map((entry) => entry.id);
            salesChanged = salesEntries.length > 0;
          } else {
            syncLinkedSalesMetadata = true;
          }
          order.confirmedAt = order.confirmedAt || nowIso();
        }
      }

      if (requestedStatus === ORDER_STATUSES.shipped) {
        order.confirmedAt = order.confirmedAt || nowIso();
        order.shippingStatus = "in_transit";
        syncLinkedSalesMetadata = true;
      }

      if (requestedStatus === ORDER_STATUSES.delivered) {
        order.confirmedAt = order.confirmedAt || nowIso();
        order.shippedAt = order.shippedAt || nowIso();
        order.shippingStatus = "delivered";
        order.deliveredAt = nowIso();
        syncLinkedSalesMetadata = true;
      }

      if (requestedStatus === ORDER_STATUSES.cancelled) {
        if (!order.stockRestoredAt) {
          restoreOrderStock(db, order);
          order.stockRestoredAt = nowIso();
        }
        const removedSales = removeOnlineOrderSales(db, order);
        if (removedSales > 0) {
          salesChanged = true;
          order.saleIds = [];
        }
        order.cancelledAt = nowIso();
        order.shippingStatus = "cancelled";
        syncLinkedSalesMetadata = false;
      }

      db.notifications.unshift({
        id: nanoid(),
        title: `Order ${order.orderNumber} ${requestedStatus}`,
        message: `Status changed from ${previousStatus} to ${requestedStatus}.`,
        createdAt: nowIso(),
        createdBy: req.user.id,
        createdByName: req.user.name,
      });
      db.notifications = db.notifications.slice(0, 200);
    }

    if (syncLinkedSalesMetadata && order.status !== ORDER_STATUSES.cancelled) {
      const effectiveEmployee = assignedEmployee
        || db.users.find((entry) => entry.id === order.assignedEmployeeId)
        || null;
      const updatedSales = syncOnlineOrderSales(db, order, effectiveEmployee);
      if (updatedSales > 0) {
        salesChanged = true;
      }
    }

    order.updatedAt = nowIso();
    await saveDb();

    if (salesChanged) {
      await syncSalesExcelSafe(db.sales);
    }

    if (previousStatus && previousStatus !== order.status) {
      try {
        const mailResult = await sendOrderStatusEmail({ order, previousStatus });
        if (!mailResult?.sent && mailResult?.reason !== "status_not_supported") {
          console.warn(
            `Order status email skipped for ${order.orderNumber}: ${mailResult?.reason || "unknown_reason"}`,
          );
        }
      } catch (mailError) {
        console.error(`Order status email failed for ${order.orderNumber}:`, mailError);
      }

      try {
        await sendOrderStatusMessage(order, previousStatus);
      } catch (whatsappError) {
        console.error(`WhatsApp status message failed for ${order.orderNumber}:`, whatsappError);
      }
    }

    await addLog({
      action: "update",
      module: "online-orders",
      user: req.user,
      details: `Updated online order ${order.orderNumber} (${order.status})`,
      ip: req.ip,
    });

    res.json({ order });
  }),
);

export default router;
