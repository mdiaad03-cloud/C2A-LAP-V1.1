import { Router } from "express";
import axios from "axios";
import { nanoid } from "nanoid";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { getDb, saveDb } from "../data/db.js";
import { addLog } from "../services/logService.js";
import { createPaymobPayment } from "../services/paymobService.js";
import {
  ORDER_STATUSES,
  buildOrderPayload,
  buildOrderStatusHistory,
  createSalesFromOnlineOrder,
  ensureOnlineEmployee,
  generateOrderNumber,
  normalizeStoreProduct,
  reserveOrderStock,
} from "../services/onlineOrderService.js";
import { sendOrderPlacedEmail } from "../services/emailService.js";
import { syncSalesWorkbook } from "../services/excelAutoSaveService.js";
import { sendOrderConfirmationMessage, sendOrderStatusMessage } from "../services/whatsappService.js";
import { nowIso } from "../utils/dateUtils.js";
import { verifyAuthToken } from "../utils/jwt.js";
import { requireText } from "../utils/validation.js";

const router = Router();

router.use((req, res, next) => {
  if (req.url.includes("check") || req.url.includes("validate") || req.url.includes("coupon")) {
    console.log(`[STORE DIAGNOSTIC] Request URL: ${req.url} | Method: ${req.method} | Auth: ${req.headers.authorization ? "Yes" : "No"}`);
    getDb().then(db => {
      db.whatsappLogs = db.whatsappLogs || [];
      db.whatsappLogs.unshift({
        id: nanoid(),
        phone: "00000000000",
        rawPhone: "SYSTEM_DIAGNOSTIC",
        text: `[DIAGNOSTIC] Requested URL: ${req.url} | Method: ${req.method} | Headers: ${JSON.stringify(req.headers)}`,
        direction: "incoming",
        createdAt: nowIso()
      });
      saveDb().catch(err => console.error("Diagnostic saveDb failed:", err));
    }).catch(err => console.error("Diagnostic getDb failed:", err));
  }
  next();
});

async function syncSalesExcelSafe(sales) {
  try {
    await syncSalesWorkbook(sales);
  } catch (error) {
    console.error("Store checkout sales sync failed:", error);
  }
}

function applyStoreFilters(products, query) {
  const textQuery = String(query.query || "").trim().toLowerCase();
  const brand = String(query.brand || "").trim().toLowerCase();
  const category = String(query.category || "").trim().toLowerCase();
  const ram = String(query.ram || "").trim().toLowerCase();
  const storage = String(query.storage || "").trim().toLowerCase();
  const minPrice = Number(query.minPrice || 0);
  const maxPrice = Number(query.maxPrice || 0);
  const featured = String(query.featured || "").trim().toLowerCase();
  const bestOffer = String(query.bestOffer || "").trim().toLowerCase();
  const sort = String(query.sort || "featured").trim().toLowerCase();

  let filtered = products.filter((product) => {
    if (brand && product.brand.toLowerCase() !== brand) {
      return false;
    }
    if (category && String(product.category || "").toLowerCase() !== category) {
      return false;
    }
    if (ram && product.ram.toLowerCase() !== ram) {
      return false;
    }
    if (storage && product.storage.toLowerCase() !== storage) {
      return false;
    }

    const price = Number(product.discountedPrice || 0);
    if (Number.isFinite(minPrice) && minPrice > 0 && price < minPrice) {
      return false;
    }
    if (Number.isFinite(maxPrice) && maxPrice > 0 && price > maxPrice) {
      return false;
    }

    if (featured === "true" && !product.featured) {
      return false;
    }
    if (bestOffer === "true" && !product.bestOffer) {
      return false;
    }

    if (textQuery) {
      const blob = [
        product.sku,
        product.laptopName,
        product.laptopNameAr,
        product.brand,
        product.ram,
        product.storage,
        product.category,
        product.categoryAr,
        product.description,
        product.descriptionAr,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!blob.includes(textQuery)) {
        return false;
      }
    }

    return true;
  });

  if (sort === "price_asc") {
    filtered = filtered.sort((a, b) => a.discountedPrice - b.discountedPrice);
  } else if (sort === "price_desc") {
    filtered = filtered.sort((a, b) => b.discountedPrice - a.discountedPrice);
  } else if (sort === "newest") {
    filtered = filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  } else {
    filtered = filtered.sort((a, b) => {
      const scoreA = Number(a.featured) * 4 + Number(a.bestOffer) * 3 + Math.min(Number(a.stock || 0), 10);
      const scoreB = Number(b.featured) * 4 + Number(b.bestOffer) * 3 + Math.min(Number(b.stock || 0), 10);
      return scoreB - scoreA;
    });
  }

  return filtered;
}

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

router.get(
  "/discount/check/:code",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const code = String(req.params.code || "").trim().toUpperCase();
    if (!code) {
      return res.status(400).json({ error: "Coupon code is required." });
    }

    const coupon = db.coupons?.find((c) => c.code.toUpperCase() === code);
    if (!coupon) {
      return res.status(404).json({ error: "Coupon not found." });
    }

    if (!coupon.isActive) {
      return res.status(400).json({ error: "This coupon is inactive." });
    }

    if (coupon.usageLimit > 0 && (coupon.usageCount || 0) >= coupon.usageLimit) {
      return res.status(400).json({ error: "This coupon usage limit has been reached." });
    }

    if (coupon.isFirstOrderOnly) {
      const customerAccount = await resolveCheckoutCustomer(req, db);
      if (!customerAccount) {
        return res.status(401).json({ error: "Please log in first to apply this first-order promo code." });
      }
      const userOrders = db.onlineOrders.filter(
        (order) =>
          (order.customerId === customerAccount.id ||
           (customerAccount.email && String(order.customerEmail || "").toLowerCase() === String(customerAccount.email).toLowerCase())) &&
          order.status !== "cancelled"
      );
      if (userOrders.length > 0) {
        return res.status(400).json({ error: "This promo code is only valid for your first order." });
      }
    }

    res.json({
      coupon: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
      },
    });
  })
);

router.get(
  "/geocode",
  asyncHandler(async (req, res) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: "Latitude and longitude are required." });
    }
    try {
      const response = await axios.get(
        "https://nominatim.openstreetmap.org/reverse",
        {
          params: {
            lat,
            lon,
            format: "json",
            "accept-language": "ar,en"
          },
          headers: {
            "User-Agent": "C2ALAP-Storefront/1.0 (mdiaad03@gmail.com)"
          }
        }
      );
      res.json(response.data);
    } catch (error) {
      console.error("Geocoding proxy error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to reverse geocode coordinates." });
    }
  })
);

router.get(
  "/meta",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const products = db.products.map(normalizeStoreProduct);
    const brands = [...new Set(products.map((product) => product.brand).filter(Boolean))].sort();
    const rams = [...new Set(products.map((product) => product.ram).filter(Boolean))].sort();
    const storages = [...new Set(products.map((product) => product.storage).filter(Boolean))].sort();
    const productCategories = [...new Set(products.map((product) => product.category).filter(Boolean))].sort();
    const settingsCategories = Array.isArray(db.storeSettings?.categories)
      ? db.storeSettings.categories.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const categories = [...new Set([...settingsCategories, ...productCategories])].slice(0, 40);

    res.json({
      brand: "C2A LAP",
      baseCurrency: "EGP",
      shipping: {
        flatRate: Number(db.storeSettings?.shippingFlatRate || 0),
        freeShippingThreshold: Number(db.storeSettings?.freeShippingThreshold || 0),
      },
      content: db.storeSettings?.content || {},
      features: db.storeSettings?.features || {},
      socialLinks: db.storeSettings?.socialLinks || {},
      filters: {
        categories,
        brands,
        rams,
        storages,
      },
      totals: {
        products: products.length,
        availableProducts: products.filter((product) => product.stock > 0).length,
      },
    });
  }),
);

router.get(
  "/products",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const products = db.products.map(normalizeStoreProduct);
    const filtered = applyStoreFilters(products, req.query);

    res.json({
      products: filtered.slice(0, 500),
      totals: {
        all: products.length,
        filtered: filtered.length,
      },
    });
  }),
);

router.get(
  "/products/:id",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const product = db.products.find((entry) => entry.id === req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found." });
    }

    const normalized = normalizeStoreProduct(product);
    const relatedProducts = db.products
      .filter((entry) => entry.id !== product.id && entry.brand === product.brand)
      .slice(0, 6)
      .map(normalizeStoreProduct);

    res.json({ product: normalized, relatedProducts });
  }),
);

router.get(
  "/products/:id/reviews",
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const product = db.products.find((entry) => entry.id === req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found." });
    }
    const reviews = Array.isArray(product.reviews) ? product.reviews : [];
    const reviewCount = reviews.length;
    const averageRating = reviewCount > 0
      ? Number((reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / reviewCount).toFixed(2))
      : 0;

    res.json({
      reviews: reviews.slice(0, 200),
      summary: {
        reviewCount,
        averageRating,
      },
    });
  }),
);

router.post(
  "/products/:id/reviews",
  authenticate,
  authorize("customer"),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const product = db.products.find((entry) => entry.id === req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found." });
    }

    const rating = Math.max(1, Math.min(5, Number.parseInt(req.body.rating, 10) || 0));
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5." });
    }
    const comment = requireText(req.body.comment, "Comment");

    product.reviews ||= [];
    const alreadyReviewed = product.reviews.find((entry) => entry.customerId === req.user.id);
    if (alreadyReviewed) {
      alreadyReviewed.rating = rating;
      alreadyReviewed.comment = comment;
      alreadyReviewed.updatedAt = nowIso();
    } else {
      product.reviews.unshift({
        id: nanoid(),
        customerId: req.user.id,
        customerName: req.user.name,
        rating,
        comment,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
      product.reviews = product.reviews.slice(0, 300);
    }
    product.updatedAt = nowIso();
    await saveDb();

    res.status(201).json({
      review: product.reviews.find((entry) => entry.customerId === req.user.id),
    });
  }),
);

router.post(
  "/checkout",
  authenticate,
  authorize("customer"),
  asyncHandler(async (req, res) => {
    const db = await getDb();
    const customerAccount = await resolveCheckoutCustomer(req, db);
    const customerPayload = {
      ...req.body.customer,
      id: customerAccount?.id,
      email: customerAccount?.email || req.body.customer?.email
    };
    const payload = buildOrderPayload({
      db,
      items: req.body.items,
      customer: customerPayload,
      paymentMethod: req.body.paymentMethod,
      discountCode: req.body.discountCode,
    });

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
      paymentStatus: payload.paymentStatus,
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
      title: `New online order ${order.orderNumber}`,
      message: `${order.customerName} placed an order for ${order.items.length} item(s).`,
      createdAt: nowIso(),
      createdBy: "system",
      createdByName: "Online Store",
    });
    db.notifications = db.notifications.slice(0, 200);

    await saveDb();
    await syncSalesExcelSafe(db.sales);

    // Paymob orders: auto-confirm since payment is already processed
    const isOnlinePayment = payload.paymentMethod === "paymob" || payload.paymentMethod === "paymob_egypt";
    if (isOnlinePayment) {
      order.status = ORDER_STATUSES.confirmed || "confirmed";
      order.statusHistory = order.statusHistory || [];
      order.statusHistory.unshift(
        buildOrderStatusHistory(ORDER_STATUSES.confirmed || "confirmed", { id: "system", name: "Auto-Confirm (Paymob)" })
      );
      order.confirmedAt = nowIso();
      order.updatedAt = nowIso();
      await saveDb();

      // Send confirmed status WhatsApp message
      try {
        await sendOrderStatusMessage(order, ORDER_STATUSES.pending);
      } catch (whatsappError) {
        console.error(`WhatsApp auto-confirm message failed for ${order.orderNumber}:`, whatsappError);
      }
    } else {
      // Cash on delivery: send confirmation prompt via WhatsApp (reply 1/2)
      try {
        await sendOrderConfirmationMessage(order);
      } catch (whatsappError) {
        console.error(`WhatsApp confirmation message failed for ${order.orderNumber}:`, whatsappError);
      }
    }

    try {
      const mailResult = await sendOrderPlacedEmail({ order });
      if (!mailResult?.sent) {
        console.warn(`Order email skipped for ${order.orderNumber}: ${mailResult?.reason || "unknown_reason"}`);
      }
    } catch (mailError) {
      console.error(`Order email failed for ${order.orderNumber}:`, mailError);
    }

    await addLog({
      action: "create",
      module: "online-orders",
      user: { id: "system", username: "online_store" },
      details: `Checkout completed for ${order.orderNumber} (${order.saleIds.length} sales records)`,
      ip: req.ip,
    });
    if (payload.paymentMethod === "paymob" || payload.paymentMethod === "paymob_egypt") {

      const paymobResult = await createPaymobPayment({
        amount: order.total,
        orderId: order.id,
        customer: {
          name: order.customerName,
          email: order.customerEmail,
          phone: order.customerPhone,
        },
      });

      const paymentUrl = typeof paymobResult === "string" ? paymobResult : paymobResult.checkoutUrl;

      return res.status(201).json({
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
        paymentUrl,
      });
    }

    res.status(201).json({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        subtotal: order.subtotal,
        shippingCost: order.shippingCost,
        discountCode: order.discountCode,
        discountAmount: order.discountAmount,
        total: order.total,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        customerAddress: order.customerAddress,
        customerCity: order.customerCity,
        customerNotes: order.customerNotes,
        items: order.items,
        createdAt: order.createdAt,
      },
    });
  }),
);

export default router;
