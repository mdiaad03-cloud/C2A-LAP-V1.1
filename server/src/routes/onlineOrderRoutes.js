import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
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

const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const screenshotDir = path.join(uploadDir, "screenshots");
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

const screenshotUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, screenshotDir),
    filename: (req, file, cb) => {
      const extension = path.extname(file.originalname || "").toLowerCase();
      const safeExtension = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extension)
        ? extension
        : ".jpg";
      cb(null, `${Date.now()}-${nanoid(8)}${safeExtension}`);
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 3,
  },
  fileFilter: (req, file, callback) => {
    const mime = String(file.mimetype || "").toLowerCase();
    if (mime.startsWith("image/")) {
      callback(null, true);
      return;
    }
    callback(new Error("Only image files are allowed."));
  },
});

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
    const currentUser = db.users.find(u => u.id === req.user.id);
    const canView = req.user.role === "admin" || (currentUser && currentUser.canViewOnlineOrders !== false);

    if (!canView) {
      return res.status(403).json({ error: "You do not have permission to view online orders." });
    }

    const visibleOrders = (req.user.role === "admin" || req.user.role === "sales")
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
  authorize("admin", "sales"),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const currentUser = db.users.find(u => u.id === req.user.id);
    const canView = req.user.role === "admin" || (currentUser && currentUser.canViewOnlineOrders !== false);

    if (!canView) {
      return res.status(403).json({ error: "You do not have permission to manage online orders." });
    }

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
    if (req.body.screenshotUrls !== undefined) {
      order.screenshotUrls = Array.isArray(req.body.screenshotUrls) ? req.body.screenshotUrls : [];
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

router.post(
  "/:id/screenshot",
  authorize("admin", "sales"),
  screenshotUpload.array("screenshots", 3),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const currentUser = db.users.find(u => u.id === req.user.id);
    const canView = req.user.role === "admin" || (currentUser && currentUser.canViewOnlineOrders !== false);

    if (!canView) {
      return res.status(403).json({ error: "You do not have permission to manage online orders." });
    }

    const order = db.onlineOrders.find((entry) => entry.id === req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Online order not found." });
    }

    const uploadedFiles = Array.isArray(req.files) ? req.files : [];
    if (uploadedFiles.length === 0) {
      return res.status(400).json({ error: "At least one screenshot image is required." });
    }

    const nextUrls = uploadedFiles.map((file) => `/uploads/screenshots/${path.basename(file.path)}`);
    order.screenshotUrls = [...(order.screenshotUrls || []), ...nextUrls].slice(0, 5);
    order.updatedAt = nowIso();
    await saveDb();

    await addLog({
      action: "upload",
      module: "online-orders",
      user: req.user,
      details: `Uploaded ${uploadedFiles.length} payment screenshot(s) to order ${order.orderNumber}`,
      ip: req.ip,
    });

    res.status(201).json({ success: true, screenshotUrls: order.screenshotUrls, order });
  }),
);

export default router;
