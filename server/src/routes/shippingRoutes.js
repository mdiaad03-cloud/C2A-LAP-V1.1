import { Router } from "express";
import { nanoid } from "nanoid";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate, authorize, csrfProtect } from "../middleware/auth.js";
import { getDb, saveDb } from "../data/db.js";
import { addLog } from "../services/logService.js";
import { nowIso } from "../utils/dateUtils.js";
import { asOptionalText, requirePositiveInteger, requireText } from "../utils/validation.js";
import {
  createBostaShipmentFromOrder,
  getBostaHealth,
  isBostaConfigured,
  listBostaPickupLocations,
  trackBostaDelivery,
} from "../services/bostaService.js";
import {
  ORDER_STATUSES,
  buildOrderStatusHistory,
  canTransitionStatus,
  resolveAssignedEmployee,
  syncOnlineOrderSales,
} from "../services/onlineOrderService.js";
import { sendOrderStatusEmail, sendShipmentCreatedEmail } from "../services/emailService.js";

const router = Router();

// ============================================================
// Bosta Webhook - POST /api/shipping/providers/bosta/webhook
// PUBLIC endpoint - no auth required (Bosta calls from their servers)
// ============================================================
router.post(
  "/providers/bosta/webhook",
  asyncHandler(async (req, res) => {
    // Respond immediately to prevent Bosta timeout
    res.status(200).json({ received: true });

    try {
      const event = req.body;
      console.log("BOSTA WEBHOOK received:", JSON.stringify(event, null, 2));

      const businessReference = String(
        event?.data?.businessReference ||
        event?.businessReference ||
        event?.data?.trackingNumber ||
        ""
      ).trim();

      const bostaState = String(
        event?.data?.state?.value ||
        event?.data?.state ||
        event?.state?.value ||
        event?.state ||
        ""
      ).trim().toLowerCase();

      if (!businessReference || !bostaState) {
        console.warn("BOSTA WEBHOOK: Missing businessReference or state, skipping.");
        return;
      }

      const db = await getDb();
      const order = db.onlineOrders.find(
        (o) => String(o.orderNumber || "").trim() === businessReference
      );

      if (!order) {
        console.warn(`BOSTA WEBHOOK: No order found for businessReference: ${businessReference}`);
        return;
      }

      const previousStatus = order.status;

      order.shippingStatus = event?.data?.state?.value || event?.data?.state || event?.state?.value || event?.state || order.shippingStatus;
      order.updatedAt = nowIso();

      const DELIVERED_STATES = ["delivered", "delivered_to_customer", "delivered-to-customer", "received"];
      const CANCELLED_STATES = ["cancelled", "canceled", "returned", "returned_to_business", "return_to_origin"];

      if (DELIVERED_STATES.includes(bostaState)) {
        if (canTransitionStatus(order.status, ORDER_STATUSES.delivered)) {
          order.status = ORDER_STATUSES.delivered;
          order.paymentStatus = "paid";
          order.deliveredAt = nowIso();
          order.statusHistory ||= [];
          order.statusHistory.unshift(buildOrderStatusHistory(ORDER_STATUSES.delivered, { id: "system", name: "Bosta Webhook" }));

          db.notifications.unshift({
            id: nanoid(),
            title: `Order ${order.orderNumber} Delivered`,
            message: `Bosta confirmed delivery for ${order.orderNumber}.`,
            createdAt: nowIso(),
            createdBy: "system",
            createdByName: "Bosta Webhook",
          });
          db.notifications = db.notifications.slice(0, 200);
        }
      } else if (CANCELLED_STATES.includes(bostaState)) {
        if (canTransitionStatus(order.status, ORDER_STATUSES.cancelled)) {
          order.status = ORDER_STATUSES.cancelled;
          order.cancelledAt = nowIso();
          order.statusHistory ||= [];
          order.statusHistory.unshift(buildOrderStatusHistory(ORDER_STATUSES.cancelled, { id: "system", name: "Bosta Webhook" }));
        }
      }

      if (order.status !== ORDER_STATUSES.cancelled) {
        try {
          const assignedEmployee = db.users?.find((u) => u.id === order.assignedEmployeeId) || null;
          syncOnlineOrderSales(db, order, assignedEmployee);
        } catch (syncErr) {
          console.error(`BOSTA WEBHOOK: Sales sync failed for ${order.orderNumber}:`, syncErr.message);
        }
      }

      await saveDb();

      if (previousStatus !== order.status) {
        await addLog({
          action: "update",
          module: "shipping",
          user: { id: "system", username: "bosta_webhook" },
          details: `Bosta webhook: ${order.orderNumber} status ${previousStatus} → ${order.status}`,
          ip: "bosta",
        });

        try {
          await sendOrderStatusEmail({ order, previousStatus });
        } catch (mailError) {
          console.error(`BOSTA WEBHOOK: Email failed for ${order.orderNumber}:`, mailError.message);
        }
      }
    } catch (err) {
      console.error("BOSTA WEBHOOK: Processing error:", err.message, err.stack);
    }
  })
);

// All routes below require admin authentication
router.use(authenticate, csrfProtect);

function buildSuccess(message, extra = {}) {
  return { success: true, message, ...extra };
}

function buildFailure(message, extra = {}) {
  return { success: false, message, error: message, ...extra };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const query = asOptionalText(req.query.query).toLowerCase();
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);

    const filtered = db.shippingCompanies.filter((company) => {
      if (!query) {
        return true;
      }

      return [company.name, company.phone, company.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });

    const total = filtered.length;
    const start = (page - 1) * limit;
    const shippingCompanies = filtered.slice(start, start + limit);

    res.json(buildSuccess("Shipping companies loaded successfully.", {
      shippingCompanies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    }));
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

    res.status(201).json(buildSuccess("Shipping company created successfully.", { shippingCompany }));
  }),
);

router.put(
  "/:id",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const company = db.shippingCompanies.find((entry) => entry.id === req.params.id);

    if (!company) {
      return res.status(404).json(buildFailure("Shipping company not found."));
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

    res.json(buildSuccess("Shipping company updated successfully.", { shippingCompany: company }));
  }),
);

router.delete(
  "/:id",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const index = db.shippingCompanies.findIndex((entry) => entry.id === req.params.id);

    if (index < 0) {
      return res.status(404).json(buildFailure("Shipping company not found."));
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

    res.json(buildSuccess("Shipping company deleted successfully."));
  }),
);

router.get(
  "/providers/bosta/health",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const health = await getBostaHealth();
    res.json(buildSuccess("Bosta provider health loaded successfully.", { provider: "bosta", health }));
  }),
);

router.get(
  "/providers/bosta/pickup-locations",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    if (!isBostaConfigured()) {
      return res.status(503).json(buildFailure("Bosta is not configured on the server."));
    }

    const pickupLocations = await listBostaPickupLocations();
    res.json(buildSuccess("Bosta pickup locations loaded successfully.", {
      provider: "bosta",
      pickupLocations,
    }));
  }),
);

router.post(
  "/providers/bosta/orders/:orderId/create-shipment",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    if (!isBostaConfigured()) {
      return res.status(503).json(buildFailure("Bosta is not configured on the server."));
    }

    const db = await getDb();
    const order = db.onlineOrders.find((entry) => entry.id === req.params.orderId);
    if (!order) {
      return res.status(404).json(buildFailure("Online order not found."));
    }

    if (![ORDER_STATUSES.confirmed, ORDER_STATUSES.shipped].includes(order.status)) {
      return res.status(409).json(
        buildFailure("Only confirmed or already shipped orders can be sent to Bosta."),
      );
    }

    const shipment = await createBostaShipmentFromOrder(order, {
      cityCode: asOptionalText(req.body.cityCode),
      zone: asOptionalText(req.body.zone),
      district: asOptionalText(req.body.district),
      firstLine: asOptionalText(req.body.firstLine),
      secondLine: asOptionalText(req.body.secondLine),
      buildingNumber: asOptionalText(req.body.buildingNumber),
      floor: asOptionalText(req.body.floor),
      apartment: asOptionalText(req.body.apartment),
      notes: asOptionalText(req.body.notes),
    });

    const previousStatus = order.status;
    order.shippingCompanyName = "Bosta";
    order.shippingCompanyPhone = order.shippingCompanyPhone || "";
    order.trackingNumber = shipment.trackingNumber || order.trackingNumber || "";
    order.shippingStatus = shipment.state || order.shippingStatus || "pickup_requested";
    order.bostaDeliveryId = shipment.deliveryId || order.bostaDeliveryId || "";
    order.updatedAt = nowIso();

    if (previousStatus === ORDER_STATUSES.confirmed && canTransitionStatus(previousStatus, ORDER_STATUSES.shipped)) {
      order.status = ORDER_STATUSES.shipped;
      order.confirmedAt = order.confirmedAt || nowIso();
      order.shippedAt = nowIso();
      order.statusHistory ||= [];
      order.statusHistory.unshift(buildOrderStatusHistory(ORDER_STATUSES.shipped, req.user));
    }

    let assignedEmployee = null;
    try {
      assignedEmployee = await resolveAssignedEmployee(db, order.assignedEmployeeId);
    } catch {
      assignedEmployee = null;
    }

    if (order.status !== ORDER_STATUSES.cancelled) {
      syncOnlineOrderSales(db, order, assignedEmployee);
    }

    db.notifications.unshift({
      id: nanoid(),
      title: `Bosta shipment created for ${order.orderNumber}`,
      message: order.trackingNumber
        ? `Tracking number ${order.trackingNumber} is ready.`
        : "Shipment created successfully.",
      createdAt: nowIso(),
      createdBy: req.user.id,
      createdByName: req.user.name,
    });
    db.notifications = db.notifications.slice(0, 200);

    await saveDb();

    try {
      await sendShipmentCreatedEmail({ order, bostaOrder: shipment });
    } catch (mailError) {
      console.error(`Bosta shipment creation notification email failed:`, mailError.message);
    }

    if (previousStatus !== order.status) {
      try {
        await sendOrderStatusEmail({ order, previousStatus });
      } catch (mailError) {
        console.error(`Bosta shipment email failed for ${order.orderNumber}:`, mailError);
      }
    }

    await addLog({
      action: "create",
      module: "shipping",
      user: req.user,
      details: `Created Bosta shipment for ${order.orderNumber}`,
      ip: req.ip,
    });

    res.status(201).json(buildSuccess("Bosta shipment created successfully.", {
      provider: "bosta",
      shipment,
      order,
    }));
  }),
);

router.post(
  "/providers/bosta/orders/:orderId/sync-status",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const order = db.onlineOrders.find((entry) => entry.id === req.params.orderId);
    if (!order) {
      return res.status(404).json(buildFailure("Online order not found."));
    }

    const trackingId = order.bostaDeliveryId || order.trackingNumber;
    if (!trackingId) {
      return res.status(400).json(buildFailure("This order does not have a Bosta delivery ID or tracking number."));
    }

    try {
      const bostaDetails = await trackBostaDelivery(trackingId);
      
      const previousStatus = order.status;
      const previousShippingStatus = order.shippingStatus;
      
      order.shippingStatus = bostaDetails.state || order.shippingStatus;
      order.updatedAt = nowIso();

      const bostaStateLower = String(bostaDetails.state || "").toLowerCase();
      if (["delivered", "delivered_to_customer", "delivered-to-customer"].includes(bostaStateLower)) {
        if (canTransitionStatus(order.status, ORDER_STATUSES.delivered)) {
          order.status = ORDER_STATUSES.delivered;
          order.paymentStatus = "paid";
          order.deliveredAt = nowIso();
          order.statusHistory ||= [];
          order.statusHistory.unshift(buildOrderStatusHistory(ORDER_STATUSES.delivered, req.user || { id: "system", name: "Bosta Sync" }));
        }
      } else if (["cancelled", "canceled", "returned", "returned_to_business"].includes(bostaStateLower)) {
        if (canTransitionStatus(order.status, ORDER_STATUSES.cancelled)) {
          order.status = ORDER_STATUSES.cancelled;
          order.cancelledAt = nowIso();
          order.statusHistory ||= [];
          order.statusHistory.unshift(buildOrderStatusHistory(ORDER_STATUSES.cancelled, req.user || { id: "system", name: "Bosta Sync" }));
        }
      }

      let assignedEmployee = null;
      try {
        assignedEmployee = await resolveAssignedEmployee(db, order.assignedEmployeeId);
      } catch {
        assignedEmployee = null;
      }
      
      if (order.status !== ORDER_STATUSES.cancelled) {
        syncOnlineOrderSales(db, order, assignedEmployee);
      }

      await saveDb();

      if (previousStatus !== order.status) {
        try {
          await sendOrderStatusEmail({ order, previousStatus });
        } catch (mailError) {
          console.error(`Bosta sync status email failed for ${order.orderNumber}:`, mailError);
        }
      }

      if (previousShippingStatus !== order.shippingStatus) {
        await addLog({
          action: "update",
          module: "shipping",
          user: req.user || { id: "system", username: "bosta_sync" },
          details: `Synced Bosta status for ${order.orderNumber}: ${previousShippingStatus} -> ${order.shippingStatus}`,
          ip: req.ip,
        });
      }

      return res.json(buildSuccess("Bosta shipping status synced successfully.", {
        order,
        bostaState: bostaDetails.state,
      }));
    } catch (error) {
      console.error(`Bosta tracking sync failed for order ${order.orderNumber}:`, error.message);
      return res.status(500).json(buildFailure(`Failed to sync with Bosta: ${error.message}`));
    }
  })
);

export default router;
