import bcrypt from "bcryptjs";
import dayjs from "dayjs";
import { nanoid } from "nanoid";
import { calculateProfit, calculateWarranty } from "../utils/calculations.js";
import { inDateRange, nowIso } from "../utils/dateUtils.js";
import { asOptionalText, requireEmail, requireText, sanitizeCountry } from "../utils/validation.js";

export const ORDER_STATUSES = {
  pending: "pending",
  confirmed: "confirmed",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
};

const TRANSITIONS = {
  [ORDER_STATUSES.pending]: [ORDER_STATUSES.confirmed, ORDER_STATUSES.cancelled],
  [ORDER_STATUSES.confirmed]: [ORDER_STATUSES.shipped, ORDER_STATUSES.delivered, ORDER_STATUSES.cancelled],
  [ORDER_STATUSES.shipped]: [ORDER_STATUSES.delivered, ORDER_STATUSES.cancelled],
  [ORDER_STATUSES.delivered]: [],
  [ORDER_STATUSES.cancelled]: [],
};

const ONLINE_EMPLOYEE_ID = "u_sales_online_store";
const ONLINE_EMPLOYEE_USERNAME = "online_store_employee";

function toMoney(value) {
  let candidate = value;
  if (typeof candidate === "string") {
    candidate = candidate.trim().replace(/[^\d,.\-]/g, "");
    if (candidate.includes(",") && !candidate.includes(".")) {
      candidate = candidate.replace(/,/g, ".");
    } else if (candidate.includes(",") && candidate.includes(".")) {
      candidate = candidate.replace(/,/g, "");
    }
  }
  const parsed = Number(candidate || 0);
  return Number(parsed.toFixed(2));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseImageUrls(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 8);
  }

  if (typeof value === "string") {
    return value
      .split(/[,;\n]/g)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  return [];
}

export function normalizeStoreProduct(product) {
  const basePrice = toMoney(product.sellingPrice ?? product.price ?? product.salePrice ?? 0);
  const discountPercent = clamp(Number(product.discountPercent || 0), 0, 90);
  const discountedPrice = toMoney(basePrice * (1 - discountPercent / 100));
  const stock = Math.max(0, Number.parseInt(product.stock || 0, 10) || 0);
  const reviews = Array.isArray(product.reviews) ? product.reviews : [];
  const reviewCount = reviews.length;
  const averageRating = reviewCount > 0
    ? Number((reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviewCount).toFixed(2))
    : 0;

  return {
    id: product.id,
    sku: asOptionalText(product.sku),
    laptopName: asOptionalText(product.laptopName),
    laptopNameAr: asOptionalText(product.laptopNameAr),
    brand: asOptionalText(product.brand),
    category: asOptionalText(product.category),
    categoryAr: asOptionalText(product.categoryAr),
    ram: asOptionalText(product.ram),
    storage: asOptionalText(product.storage),
    price: basePrice,
    discountPercent,
    discountedPrice,
    availability: stock > 0 ? "in_stock" : "out_of_stock",
    stock,
    warrantyMonths: Math.max(1, Number.parseInt(product.warrantyMonths || 12, 10) || 12),
    imageUrls: parseImageUrls(product.imageUrls),
    description:
      asOptionalText(product.description) ||
      `${asOptionalText(product.brand)} ${asOptionalText(product.laptopName)} configured with ${asOptionalText(
        product.ram,
      )} RAM and ${asOptionalText(product.storage)} storage.`,
    descriptionAr:
      asOptionalText(product.descriptionAr) ||
      `${asOptionalText(product.brand)} ${asOptionalText(product.laptopNameAr || product.laptopName)} مزود بذاكرة ${asOptionalText(
        product.ram,
      )} وتخزين ${asOptionalText(product.storage)}.`,
    specs: {
      cpu: asOptionalText(product.specs?.cpu),
      gpu: asOptionalText(product.specs?.gpu),
      display: asOptionalText(product.specs?.display),
      os: asOptionalText(product.specs?.os),
      weight: asOptionalText(product.specs?.weight),
      battery: asOptionalText(product.specs?.battery),
    },
    specsAr: {
      cpu: asOptionalText(product.specsAr?.cpu),
      gpu: asOptionalText(product.specsAr?.gpu),
      display: asOptionalText(product.specsAr?.display),
      os: asOptionalText(product.specsAr?.os),
      weight: asOptionalText(product.specsAr?.weight),
      battery: asOptionalText(product.specsAr?.battery),
    },
    shippingInfo:
      asOptionalText(product.shippingInfo) ||
      "Ships within 1-2 business days. Delivery timeline depends on destination city.",
    shippingInfoAr:
      asOptionalText(product.shippingInfoAr) ||
      "يتم الشحن خلال 1-2 يوم عمل، ومدة التوصيل تعتمد على المدينة.",
    reviewCount,
    averageRating,
    reviews: reviews.slice(0, 100),
    featured: Boolean(product.featured) || stock > 0,
    bestOffer: Boolean(product.bestOffer) || discountPercent >= 8,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export function computeShippingCost(subtotal, settings = {}) {
  const normalizedSubtotal = Math.max(0, Number(subtotal || 0));
  const flatRate = Math.max(0, Number(settings.shippingFlatRate || 0));
  const freeShippingThreshold = Math.max(0, Number(settings.freeShippingThreshold || 0));
  if (freeShippingThreshold > 0 && normalizedSubtotal >= freeShippingThreshold) {
    return 0;
  }
  return flatRate;
}

export function generateOrderNumber(index = 1) {
  const stamp = dayjs().format("YYYYMMDD");
  const serial = String(Math.max(1, index)).padStart(4, "0");
  return `C2A-ON-${stamp}-${serial}`;
}

export function isConvertedOrder(order) {
  return [ORDER_STATUSES.confirmed, ORDER_STATUSES.shipped, ORDER_STATUSES.delivered].includes(order.status);
}

export function canTransitionStatus(currentStatus, nextStatus) {
  if (!nextStatus || currentStatus === nextStatus) {
    return true;
  }
  const allowed = TRANSITIONS[currentStatus] || [];
  return allowed.includes(nextStatus);
}

export function buildOrderStatusHistory(status, changedBy) {
  return {
    status,
    changedAt: nowIso(),
    changedById: changedBy?.id || "system",
    changedByName: changedBy?.name || "System",
  };
}

function normalizeOrderItem(product, quantity) {
  const shaped = normalizeStoreProduct(product);
  const unitPrice = shaped.price;
  const discountedUnitPrice = shaped.discountedPrice;
  const lineTotal = toMoney(discountedUnitPrice * quantity);

  return {
    productId: product.id,
    sku: shaped.sku,
    laptopName: shaped.laptopName,
    brand: shaped.brand,
    ram: shaped.ram,
    storage: shaped.storage,
    quantity,
    unitPrice,
    discountPercent: shaped.discountPercent,
    discountedUnitPrice,
    lineTotal,
    purchasePrice: toMoney(product.purchasePrice ?? product.costPrice ?? 0),
    warrantyMonths: shaped.warrantyMonths,
  };
}

export function buildOrderPayload({ db, items, customer, paymentMethod, discountCode }) {
  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error("Cart items are required.");
    error.status = 400;
    throw error;
  }

  const sanitizedItems = [];
  const aggregated = new Map();

  for (const rawItem of items) {
    const productId = String(rawItem?.productId || "").trim();
    const quantity = Number.parseInt(rawItem?.quantity, 10);
    if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
      const error = new Error("Each cart item must include valid productId and quantity.");
      error.status = 400;
      throw error;
    }
    aggregated.set(productId, (aggregated.get(productId) || 0) + quantity);
  }

  for (const [productId, quantity] of aggregated.entries()) {
    const product = db.products.find((entry) => entry.id === productId);
    if (!product) {
      const error = new Error(`Product not found (${productId}).`);
      error.status = 404;
      throw error;
    }

    const stock = Math.max(0, Number.parseInt(product.stock || 0, 10) || 0);
    if (stock < quantity) {
      const error = new Error(`${product.laptopName} has only ${stock} units left in stock.`);
      error.status = 409;
      throw error;
    }

    sanitizedItems.push(normalizeOrderItem(product, quantity));
  }

  const subtotal = toMoney(sanitizedItems.reduce((sum, item) => sum + item.lineTotal, 0));
  let shippingCost = toMoney(computeShippingCost(subtotal, db.storeSettings));

  let discountAmount = 0;
  const normalizedCode = String(discountCode || "").trim().toUpperCase();
  if (normalizedCode) {
    const coupon = db.coupons?.find(
      (c) => c.code.toUpperCase() === normalizedCode && c.isActive
    );
    if (coupon) {
      if (coupon.usageLimit > 0 && (coupon.usageCount || 0) >= coupon.usageLimit) {
        const error = new Error("This coupon usage limit has been reached.");
        error.status = 400;
        throw error;
      }
      
      if (coupon.type === "percent") {
        discountAmount = toMoney(subtotal * (coupon.value / 100));
      } else if (coupon.type === "fixed") {
        discountAmount = toMoney(coupon.value);
      } else if (coupon.type === "free_shipping") {
        discountAmount = shippingCost;
        shippingCost = 0;
      }
    } else {
      const error = new Error("Invalid or inactive coupon code.");
      error.status = 400;
      throw error;
    }
  }

  const total = toMoney(Math.max(0, subtotal + shippingCost - discountAmount));

  const customerName = requireText(customer?.name, "Customer name");
  const customerEmail = requireEmail(customer?.email, "Customer email");
  const customerPhone = requireText(customer?.phone, "Customer phone");
  const customerCountry = sanitizeCountry(customer?.country);
  const customerAddress = requireText(customer?.address, "Customer address");
  const customerCity = requireText(customer?.city, "City");
  const customerNotes = asOptionalText(customer?.notes);

  const method = String(paymentMethod || "cash_on_delivery").trim().toLowerCase();
  const allowedPaymentMethods = [
    "cash_on_delivery",
    "paymob_egypt",
  ];
  if (!allowedPaymentMethods.includes(method)) {
    const error = new Error("Unsupported payment method.");
    error.status = 400;
    throw error;
  }

  const paymentStatus = method === "cash_on_delivery" ? "pending_collection" : "pending_verification";

  return {
    items: sanitizedItems,
    subtotal,
    shippingCost,
    discountCode: normalizedCode,
    discountAmount,
    total,
    customerName,
    customerEmail,
    customerPhone,
    customerCountry,
    customerAddress,
    customerCity,
    customerNotes,
    paymentMethod: method,
    paymentStatus,
  };
}

export function reserveOrderStock(db, items) {
  for (const item of items) {
    const product = db.products.find((entry) => entry.id === item.productId);
    if (!product) {
      continue;
    }
    product.stock = Math.max(0, Number.parseInt(product.stock || 0, 10) - item.quantity);
    product.updatedAt = nowIso();
  }
}

export function restoreOrderStock(db, order) {
  for (const item of order.items || []) {
    const product = db.products.find((entry) => entry.id === item.productId);
    if (!product) {
      continue;
    }
    product.stock = Math.max(0, Number.parseInt(product.stock || 0, 10) + Number(item.quantity || 0));
    product.updatedAt = nowIso();
  }
}

export async function ensureOnlineEmployee(db) {
  const existing = db.users.find(
    (entry) => entry.id === ONLINE_EMPLOYEE_ID || entry.username.toLowerCase() === ONLINE_EMPLOYEE_USERNAME,
  );
  if (existing) {
    return existing;
  }

  const employee = {
    id: ONLINE_EMPLOYEE_ID,
    name: "Online Store",
    username: ONLINE_EMPLOYEE_USERNAME,
    passwordHash: await bcrypt.hash(`disabled-${nowIso()}`, 10),
    role: "sales",
    isActive: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    lastLoginAt: null,
  };

  db.users.push(employee);
  return employee;
}

export async function resolveAssignedEmployee(db, requestedEmployeeId) {
  if (requestedEmployeeId) {
    const employee = db.users.find((entry) => entry.id === requestedEmployeeId && entry.role === "sales");
    if (!employee) {
      const error = new Error("Assigned employee must be an existing sales user.");
      error.status = 400;
      throw error;
    }
    return employee;
  }

  return ensureOnlineEmployee(db);
}

function upsertContactFromOrder(db, order, saleEntries) {
  const normalizedPhone = String(order.customerPhone || "").toLowerCase();
  let contact = db.contacts.find(
    (entry) =>
      (normalizedPhone && String(entry.phone || "").toLowerCase() === normalizedPhone) ||
      (!normalizedPhone &&
        String(entry.name || "").toLowerCase() === String(order.customerName || "").toLowerCase()),
  );

  if (!contact) {
    contact = {
      id: nanoid(),
      name: order.customerName || "Online Customer",
      phone: order.customerPhone || "",
      address: `${order.customerAddress || ""}, ${order.customerCity || ""}`.replace(/^,\s*/, ""),
      notes: order.customerNotes || "",
      purchaseHistory: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.contacts.push(contact);
  }

  contact.purchaseHistory ||= [];
  for (const sale of saleEntries) {
    contact.purchaseHistory.unshift({
      saleId: sale.id,
      laptopName: sale.laptopName,
      sellingPrice: sale.sellingPrice,
      purchaseDate: sale.purchaseDate,
    });
  }
  contact.updatedAt = nowIso();
}

export function createSalesFromOnlineOrder(db, order, employee) {
  const saleEntries = [];
  const subtotal = Number(order.subtotal || 0);
  const shippingCost = Number(order.shippingCost || 0);
  let consumedShipping = 0;

  const items = Array.isArray(order.items) ? order.items : [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    let lineShipping = 0;
    if (shippingCost > 0 && subtotal > 0) {
      if (index === items.length - 1) {
        lineShipping = toMoney(shippingCost - consumedShipping);
      } else {
        lineShipping = toMoney((shippingCost * Number(item.lineTotal || 0)) / subtotal);
        consumedShipping = toMoney(consumedShipping + lineShipping);
      }
    }

    const linePurchasePrice = toMoney(Number(item.purchasePrice || 0) * Number(item.quantity || 0));
    const lineSellingPrice = toMoney(item.lineTotal || 0);
    const warranty = calculateWarranty(order.createdAt, item.warrantyMonths || 12);

    const sale = {
      id: nanoid(),
      laptopName: item.laptopName,
      brand: item.brand,
      ram: item.ram,
      storage: item.storage,
      quantity: Number(item.quantity || 0),
      purchasePrice: linePurchasePrice,
      sellingPrice: lineSellingPrice,
      shippingCost: lineShipping,
      profit: toMoney(calculateProfit(lineSellingPrice, linePurchasePrice, lineShipping)),
      purchaseDate: warranty.purchaseDate,
      warrantyMonths: warranty.warrantyMonths,
      warrantyEndDate: warranty.warrantyEndDate,
      replacementDeadline: warranty.replacementDeadline,
      returnDeadline: warranty.returnDeadline,
      warrantyDaysRemaining: warranty.warrantyDaysRemaining,
      replacementExpired: warranty.replacementExpired,
      returnExpired: warranty.returnExpired,
      shippingCompanyName: asOptionalText(order.shippingCompanyName),
      shippingCompanyPhone: asOptionalText(order.shippingCompanyPhone),
      trackingNumber: asOptionalText(order.trackingNumber),
      representativeName: asOptionalText(order.assignedEmployeeName || employee?.name || "Online Store"),
      clientName: asOptionalText(order.customerName),
      clientPhone: asOptionalText(order.customerPhone),
      clientAddress: `${asOptionalText(order.customerAddress)}, ${asOptionalText(order.customerCity)}`
        .replace(/^,\s*/, "")
        .replace(/,\s*$/, ""),
      notes: `Online order ${order.orderNumber}${order.customerNotes ? ` | ${order.customerNotes}` : ""}`,
      createdBy: employee?.id || ONLINE_EMPLOYEE_ID,
      createdByName: employee?.name || "Online Store",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      source: "online-store",
      onlineOrderId: order.id,
      orderNumber: order.orderNumber,
      onlineOrderStatus: order.status,
    };

    db.sales.push(sale);
    saleEntries.push(sale);
  }

  upsertContactFromOrder(db, order, saleEntries);
  return saleEntries;
}

export function syncOnlineOrderSales(db, order, employee) {
  const saleIds = new Set((order.saleIds || []).map(String));
  let updatedCount = 0;

  for (const sale of db.sales) {
    const isLinked = saleIds.has(String(sale.id)) || String(sale.onlineOrderId || "") === String(order.id);
    if (!isLinked) {
      continue;
    }

    if (employee) {
      sale.createdBy = employee.id;
      sale.createdByName = employee.name;
      sale.representativeName = employee.name;
    }

    sale.shippingCompanyName = asOptionalText(order.shippingCompanyName);
    sale.shippingCompanyPhone = asOptionalText(order.shippingCompanyPhone);
    sale.trackingNumber = asOptionalText(order.trackingNumber);
    sale.clientName = asOptionalText(order.customerName);
    sale.clientPhone = asOptionalText(order.customerPhone);
    sale.clientAddress = `${asOptionalText(order.customerAddress)}, ${asOptionalText(order.customerCity)}`
      .replace(/^,\s*/, "")
      .replace(/,\s*$/, "");
    sale.notes = `Online order ${order.orderNumber}${order.customerNotes ? ` | ${order.customerNotes}` : ""}`;
    sale.onlineOrderStatus = order.status;
    sale.updatedAt = nowIso();
    updatedCount += 1;
  }

  return updatedCount;
}

export function removeOnlineOrderSales(db, order) {
  const saleIds = new Set((order.saleIds || []).map(String));
  const removedIds = [];

  db.sales = db.sales.filter((sale) => {
    const linked = saleIds.has(String(sale.id)) || String(sale.onlineOrderId || "") === String(order.id);
    if (linked) {
      removedIds.push(String(sale.id));
    }
    return !linked;
  });

  if (removedIds.length === 0) {
    return 0;
  }

  const removedSet = new Set(removedIds);
  for (const contact of db.contacts) {
    if (!Array.isArray(contact.purchaseHistory)) {
      continue;
    }
    contact.purchaseHistory = contact.purchaseHistory.filter((item) => !removedSet.has(String(item.saleId)));
    contact.updatedAt = nowIso();
  }

  return removedIds.length;
}

export function filterOnlineOrders(orders, filters = {}) {
  const status = String(filters.status || "").trim().toLowerCase();
  const query = String(filters.query || "").trim().toLowerCase();
  const city = String(filters.city || "").trim().toLowerCase();

  return orders.filter((order) => {
    if (status && order.status !== status) {
      return false;
    }

    if (!inDateRange(order.createdAt, filters.dateFrom, filters.dateTo)) {
      return false;
    }

    if (city && String(order.customerCity || "").toLowerCase() !== city) {
      return false;
    }

    if (query) {
      const blob = [
        order.orderNumber,
        order.customerName,
        order.customerPhone,
        order.customerCity,
        order.status,
        order.assignedEmployeeName,
        order.trackingNumber,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!blob.includes(query)) {
        return false;
      }
    }

    return true;
  });
}

export function buildOnlineOrderAnalytics({
  allOrders,
  filteredOrders,
  products,
  sales,
  lowStockThreshold = 3,
}) {
  const sourceOrders = filteredOrders || [];
  const byStatus = {
    pending: 0,
    confirmed: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
  };

  for (const order of sourceOrders) {
    if (Object.prototype.hasOwnProperty.call(byStatus, order.status)) {
      byStatus[order.status] += 1;
    }
  }

  const convertedOrders = sourceOrders.filter((order) => isConvertedOrder(order));
  const totalOrders = sourceOrders.length;
  const conversionRate = totalOrders > 0 ? Number(((convertedOrders.length / totalOrders) * 100).toFixed(2)) : 0;
  const onlineRevenue = toMoney(convertedOrders.reduce((sum, order) => sum + Number(order.total || 0), 0));
  const averageOrderValue = convertedOrders.length > 0
    ? toMoney(onlineRevenue / convertedOrders.length)
    : 0;

  const cityMap = {};
  const productMap = {};
  for (const order of convertedOrders) {
    const city = order.customerCity || "Unknown";
    cityMap[city] = (cityMap[city] || 0) + 1;

    for (const item of order.items || []) {
      const key = item.laptopName || item.sku || "Unknown";
      productMap[key] ||= {
        laptopName: item.laptopName || "Unknown",
        brand: item.brand || "",
        quantity: 0,
        revenue: 0,
      };
      productMap[key].quantity += Number(item.quantity || 0);
      productMap[key].revenue = toMoney(productMap[key].revenue + Number(item.lineTotal || 0));
    }
  }

  const topCities = Object.entries(cityMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([cityName, ordersCount]) => ({ cityName, ordersCount }));

  const bestSellingProducts = Object.values(productMap)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 8);

  const normalizedThreshold = Number(lowStockThreshold || 3) || 3;
  const lowStockProducts = (products || [])
    .filter((product) => Number(product.stock || 0) <= normalizedThreshold)
    .slice(0, 10)
    .map((product) => ({
      id: product.id,
      laptopName: product.laptopName,
      brand: product.brand,
      stock: Number(product.stock || 0),
    }));

  const allOnlineRevenue = toMoney(
    (allOrders || [])
      .filter((order) => isConvertedOrder(order))
      .reduce((sum, order) => sum + Number(order.total || 0), 0),
  );

  const manualRevenue = toMoney(
    (sales || [])
      .filter((sale) => sale.source !== "online-store")
      .reduce((sum, sale) => sum + Number(sale.sellingPrice || 0), 0),
  );

  return {
    totalOrders,
    byStatus,
    conversionRate,
    onlineRevenue,
    averageOrderValue,
    topCities,
    bestSellingProducts,
    lowStockProducts,
    revenueComparison: {
      online: allOnlineRevenue,
      manual: manualRevenue,
    },
  };
}
