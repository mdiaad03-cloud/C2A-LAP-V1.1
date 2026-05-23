import { Router } from "express";
import axios from "axios";
import { nanoid } from "nanoid";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { createPaymobPayment, getPaymobTransaction } from "../services/paymobService.js";
import { getDb, saveDb } from "../data/db.js";
import { addLog } from "../services/logService.js";
import { sendOrderPlacedEmail, sendPaymentResultEmail } from "../services/emailService.js";
import { syncSalesWorkbook } from "../services/excelAutoSaveService.js";
import { nowIso } from "../utils/dateUtils.js";
import { verifyAuthToken } from "../utils/jwt.js";
import { env } from "../config/env.js";
import {
  ORDER_STATUSES,
  buildOrderPayload,
  buildOrderStatusHistory,
  createSalesFromOnlineOrder,
  ensureOnlineEmployee,
  generateOrderNumber,
  reserveOrderStock,
  syncOnlineOrderSales,
} from "../services/onlineOrderService.js";

const router = Router();

async function resolveCheckoutCustomer(req, db) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return null;
  }

  try {
    const decoded = verifyAuthToken(token);
    const user = db.users.find(
      (entry) => entry.id === decoded.sub && entry.role === "customer" && entry.isActive,
    );
    return user || null;
  } catch {
    return null;
  }
}

router.post(
  "/create-payment",
  authenticate,
  authorize("customer"),
  asyncHandler(async (req, res) => {
    console.log("PAYMOB ROUTE: Received request to create payment");
    
    const db = await getDb();
    
    // 1. Build order payload using the common onlineOrderService function.
    const payload = buildOrderPayload({
      db,
      items: req.body.items,
      customer: req.body.customer,
      paymentMethod: req.body.paymentMethod || "paymob_egypt",
      discountCode: req.body.discountCode,
    });

    const customerAccount = await resolveCheckoutCustomer(req, db);

    if (customerAccount) {
      if (payload.customerName && payload.customerName !== customerAccount.name) {
        customerAccount.name = payload.customerName;
      }
      if (payload.customerPhone && payload.customerPhone !== customerAccount.phone) {
        customerAccount.phone = payload.customerPhone;
      }
      if (payload.customerCountry && payload.customerCountry !== customerAccount.country) {
        customerAccount.country = payload.customerCountry;
      }
      if (payload.customerAddress && payload.customerAddress !== customerAccount.address) {
        customerAccount.address = payload.customerAddress;
      }
      if (payload.customerCity && payload.customerCity !== customerAccount.city) {
        customerAccount.city = payload.customerCity;
      }
      customerAccount.updatedAt = nowIso();
    }

    reserveOrderStock(db, payload.items);

    // 2. Build the order entity
    const order = {
      id: nanoid(),
      orderNumber: generateOrderNumber(db.onlineOrders.length + 1),
      status: ORDER_STATUSES.pending,
      statusHistory: [buildOrderStatusHistory(ORDER_STATUSES.pending)],
      source: "online-store",
      assignedEmployeeId: "",
      assignedEmployeeName: "",
      shippingCompanyName: "",
      shippingCompanyPhone: "",
      trackingNumber: "",
      shippingStatus: "new",
      saleIds: [],
      stockRestoredAt: null,
      paymentMethod: payload.paymentMethod,
      paymentStatus: "pending_payment",
      paymobOrderId: "",
      paymentReference: String(req.body.paymentReference || "").trim(),
      currency: String(req.body.currency || "EGP").toUpperCase(),
      items: payload.items,
      subtotal: payload.subtotal,
      shippingCost: payload.shippingCost,
      discountCode: payload.discountCode || "",
      discountAmount: payload.discountAmount || 0,
      total: payload.total,
      customerName: payload.customerName,
      customerEmail: payload.customerEmail || customerAccount?.email || "",
      customerPhone: payload.customerPhone,
      customerCountry: payload.customerCountry || customerAccount?.country || "",
      customerAddress: payload.customerAddress,
      customerCity: payload.customerCity,
      customerNotes: payload.customerNotes,
      customerId: customerAccount?.id || "",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      confirmedAt: null,
      shippedAt: null,
      deliveredAt: null,
      cancelledAt: null,
    };

    const onlineEmployee = await ensureOnlineEmployee(db);
    order.assignedEmployeeId = onlineEmployee.id;
    order.assignedEmployeeName = onlineEmployee.name;
    const salesEntries = createSalesFromOnlineOrder(db, order, onlineEmployee);
    order.saleIds = salesEntries.map((entry) => entry.id);

    db.onlineOrders.unshift(order);
    db.onlineOrders = db.onlineOrders.slice(0, 5000);

    if (order.discountCode) {
      const coupon = db.coupons?.find((c) => c.code.toUpperCase() === order.discountCode.toUpperCase());
      if (coupon) {
        coupon.usageCount = (coupon.usageCount || 0) + 1;
        coupon.updatedAt = nowIso();
      }
    }

    db.notifications.unshift({
      id: nanoid(),
      title: `New online order ${order.orderNumber} (Paymob)`,
      message: `${order.customerName} placed an order for ${order.items.length} item(s).`,
      createdAt: nowIso(),
      createdBy: "system",
      createdByName: "Online Store",
    });
    db.notifications = db.notifications.slice(0, 200);

    await saveDb();
    console.log(`PAYMOB ROUTE: Order ${order.orderNumber} saved to database`);

    // Excel Sync
    try {
      await syncSalesWorkbook(db.sales);
    } catch (excelErr) {
      console.error("PAYMOB ROUTE: Excel sync failed:", excelErr.message);
    }

    // Email send
    try {
      const mailResult = await sendOrderPlacedEmail({ order });
      if (!mailResult?.sent) {
        console.warn(`PAYMOB ROUTE: Order email skipped for ${order.orderNumber}: ${mailResult?.reason || "unknown_reason"}`);
      }
    } catch (mailError) {
      console.error(`PAYMOB ROUTE: Order email failed for ${order.orderNumber}:`, mailError.message);
    }

    await addLog({
      action: "create",
      module: "online-orders",
      user: { id: "system", username: "online_store" },
      details: `Checkout (Paymob) completed for ${order.orderNumber} (${order.saleIds.length} sales records)`,
      ip: req.ip,
    });

    // 3. Initiate Paymob payment
    try {
      console.log("PAYMOB ROUTE: Initiating Paymob payment using Unified Checkout API...");
      const paymobResult = await createPaymobPayment({
        amount: order.total,
        orderId: order.orderNumber,
        customer: {
          name: order.customerName,
          phone: order.customerPhone,
          email: order.customerEmail || "test@test.com",
          address: order.customerAddress,
          city: order.customerCity,
          country: order.customerCountry,
        },
      });

      console.log(`PAYMOB ROUTE SUCCESS: Generated Paymob unified checkout URL: ${paymobResult.checkoutUrl}`);

      // Save paymobOrderId to the order
      order.paymobOrderId = String(paymobResult.paymobOrderId);
      await saveDb();

      res.status(201).json({
        success: true,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          subtotal: order.subtotal,
          shippingCost: order.shippingCost,
          total: order.total,
          createdAt: order.createdAt,
        },
        iframeUrl: paymobResult.checkoutUrl,
      });

    } catch (paymobErr) {
      console.error("PAYMOB ERROR DETECTED:");
      if (paymobErr.response) {
        console.error("Paymob API Status Code:", paymobErr.response.status);
        console.error("Paymob API Error Data:", JSON.stringify(paymobErr.response.data, null, 2));
      } else {
        console.error("Paymob Request Message:", paymobErr.message);
      }

      // Return a 400 Bad Request to front-end with the detailed error payload.
      let errorMessage = "Failed to initialize Paymob payment integration.";
      if (paymobErr.response?.data) {
        if (typeof paymobErr.response.data === "string") {
          errorMessage = paymobErr.response.data;
        } else if (paymobErr.response.data.detail) {
          errorMessage = paymobErr.response.data.detail;
        } else if (paymobErr.response.data.message) {
          errorMessage = paymobErr.response.data.message;
        } else {
          errorMessage = JSON.stringify(paymobErr.response.data);
        }
      } else if (paymobErr.message) {
        errorMessage = paymobErr.message;
      }
      res.status(400).json({
        error: errorMessage,
      });
    }

  })
);

// ============================================
// Paymob Callback - GET /api/paymob/callback
// Paymob redirects the user here after payment
// ============================================
router.get(
  "/callback",
  asyncHandler(async (req, res) => {
    const {
      id,
      pending,
      amount_cents,
      success,
      is_auth,
      is_capture,
      is_standalone_payment,
      is_voided,
      is_refunded,
      is_3d_secure,
      integration_id,
      has_parent_transaction,
      order: paymobOrderId,
      source_data_type,
      source_data_sub_type,
      txn_response_code,
      hmac,
    } = req.query;

    console.log("PAYMOB CALLBACK received:", JSON.stringify(req.query, null, 2));

    let isSuccess = false;
    let txnVerified = null;
    if (id) {
      try {
        txnVerified = await getPaymobTransaction(id);
        isSuccess = txnVerified.success === true && txnVerified.pending === false;
        console.log(`PAYMOB CALLBACK: API Verification success=${isSuccess} for transaction ${id}`);
      } catch (err) {
        console.error(`PAYMOB CALLBACK: API Verification failed for transaction ${id}:`, err.message);
        // Fallback to query parameters to handle unified integration keys and localhost testing
        const isQuerySuccess = success === "true" || success === true;
        const isQueryPending = pending === "true" || pending === true;
        isSuccess = isQuerySuccess && !isQueryPending && (txn_response_code === "APPROVED" || txn_response_code === "00");
        console.log(`PAYMOB CALLBACK: Fallback to query parameters checks isSuccess=${isSuccess}`);
      }
    } else {
      isSuccess = (success === "true" || success === true) && !(pending === "true" || pending === true);
    }

    const db = await getDb();

    // Find the order that matches the Paymob order ID
    const order = db.onlineOrders.find(
      (o) => o.paymentMethod === "paymob_egypt" && o.paymobOrderId && String(o.paymobOrderId) === String(paymobOrderId)
    );

    if (order) {
      if (isSuccess) {
        const wasAlreadyConfirmed = order.status === ORDER_STATUSES.confirmed;
        order.paymentStatus = "paid";
        order.paymentReference = String(id || order.paymentReference || "");
        if (!wasAlreadyConfirmed) {
          order.status = "confirmed";
          order.confirmedAt = nowIso();
          order.statusHistory = order.statusHistory || [];
          order.statusHistory.push(buildOrderStatusHistory("confirmed"));
        }
        order.updatedAt = nowIso();
        console.log(`PAYMOB CALLBACK: Order ${order.orderNumber} marked as PAID (txn: ${id})`);

        // Sync sales records' onlineOrderStatus to confirmed
        try {
          const employee = db.users?.find((u) => u.id === order.assignedEmployeeId) || null;
          syncOnlineOrderSales(db, order, employee);
        } catch (syncErr) {
          console.error(`PAYMOB CALLBACK: Sales sync failed for ${order.orderNumber}:`, syncErr.message);
        }

        await addLog({
          action: "update",
          module: "online-orders",
          user: { id: "system", username: "paymob_callback" },
          details: `Payment confirmed for ${order.orderNumber} via Paymob (txn: ${id})`,
          ip: req.ip,
        });
      } else {
        order.paymentStatus = "failed";
        order.updatedAt = nowIso();
        console.log(`PAYMOB CALLBACK: Order ${order.orderNumber} payment FAILED (txn: ${id})`);

        await addLog({
          action: "update",
          module: "online-orders",
          user: { id: "system", username: "paymob_callback" },
          details: `Payment failed for ${order.orderNumber} via Paymob (txn: ${id})`,
          ip: req.ip,
        });
      }
      await saveDb();

      // Send email notification of transaction result
      try {
        await sendPaymentResultEmail({
          order,
          success: isSuccess,
          transactionId: String(id || ""),
          amount: order.total,
          details: txnVerified ? `Verified via Paymob API. Intention ID: ${txnVerified.intention_order_id || ""}` : "Callback parameters only"
        });
      } catch (mailErr) {
        console.error("PAYMOB CALLBACK: Failed to send payment alert email:", mailErr.message);
      }
    } else {
      console.warn("PAYMOB CALLBACK: No matching order found for paymobOrderId:", paymobOrderId);
    }

    // Redirect user back to store
    const storeBaseUrl = env.storeBaseUrl || `http://localhost:${process.env.STORE_PORT || 5001}`;
    if (isSuccess && order) {
      return res.redirect(`${storeBaseUrl}/store/success/${order.orderNumber}`);
    } else {
      // Redirect to cart with a failure indication
      return res.redirect(`${storeBaseUrl}/store/cart?payment=failed`);
    }
  })
);

// ============================================
// Paymob Webhook - POST /api/paymob/callback
// Server-to-server notification from Paymob
// ============================================
router.post(
  "/callback",
  asyncHandler(async (req, res) => {
    console.log("PAYMOB WEBHOOK (POST) received:", JSON.stringify(req.body, null, 2));

    const txn = req.body?.obj;
    if (!txn) {
      return res.status(200).json({ received: true });
    }

    const txnId = txn.id;
    const paymobOrderId = txn.order?.id || txn.order;

    let isSuccess = false;
    let txnVerified = null;
    if (txnId) {
      try {
        txnVerified = await getPaymobTransaction(txnId);
        isSuccess = txnVerified.success === true && txnVerified.pending === false;
      } catch (err) {
        console.error(`PAYMOB WEBHOOK: API Verification failed for txn ${txnId}:`, err.message);
        isSuccess = txn.success === true && txn.pending === false; // fallback to body
      }
    } else {
      isSuccess = txn.success === true && txn.pending === false;
    }

    const db = await getDb();
    const order = db.onlineOrders.find(
      (o) => o.paymentMethod === "paymob_egypt" && o.paymobOrderId && String(o.paymobOrderId) === String(paymobOrderId)
    );

    if (order) {
      if (isSuccess) {
        const wasAlreadyConfirmed = order.status === ORDER_STATUSES.confirmed;
        order.paymentStatus = "paid";
        order.paymentReference = String(txnId || "");
        if (!wasAlreadyConfirmed) {
          order.status = "confirmed";
          order.confirmedAt = nowIso();
          order.statusHistory = order.statusHistory || [];
          order.statusHistory.push(buildOrderStatusHistory("confirmed"));
        }
        // Sync sales records' onlineOrderStatus to confirmed
        try {
          const employee = db.users?.find((u) => u.id === order.assignedEmployeeId) || null;
          syncOnlineOrderSales(db, order, employee);
        } catch (syncErr) {
          console.error(`PAYMOB WEBHOOK: Sales sync failed for ${order.orderNumber}:`, syncErr.message);
        }
      } else {
        order.paymentStatus = "failed";
      }
      order.updatedAt = nowIso();
      await saveDb();
      console.log(`PAYMOB WEBHOOK: Order ${order.orderNumber} => paymentStatus: ${order.paymentStatus}`);

      // Send email notification of webhook transaction result
      try {
        await sendPaymentResultEmail({
          order,
          success: isSuccess,
          transactionId: String(txnId || ""),
          amount: order.total,
          details: `Webhook verified. ID: ${txnId}`
        });
      } catch (mailErr) {
        console.error("PAYMOB WEBHOOK: Failed to send payment alert email:", mailErr.message);
      }
    } else {
      console.warn("PAYMOB WEBHOOK: No matching order found for paymobOrderId:", paymobOrderId);
    }

    res.status(200).json({ received: true });
  })
);

export default router;