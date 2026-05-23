import { env } from "../config/env.js";

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || "").trim().replace(/\/+$/, "");
}

function createHttpError(message, status = 500, details = null) {
  const error = new Error(message);
  error.status = status;
  if (details !== null) {
    error.details = details;
  }
  return error;
}

function splitCustomerName(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return { firstName: "Customer", lastName: "C2A LAP" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "Customer" };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function extractPayloadArray(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  if (Array.isArray(payload?.result)) {
    return payload.result;
  }
  if (Array.isArray(payload?.pickupLocations)) {
    return payload.pickupLocations;
  }
  if (Array.isArray(payload?.cities)) {
    return payload.cities;
  }
  return [];
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function bostaRequest(pathname, options = {}) {
  if (!isBostaConfigured()) {
    throw createHttpError("Bosta is not configured on the server.", 503);
  }

  const baseUrl = normalizeBaseUrl(env.bostaApiBaseUrl);
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      Authorization: env.bostaApiKey,
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  const payload = await parseResponse(response);
  if (!response.ok) {
    const message =
      payload?.message
      || payload?.error
      || payload?.raw
      || `Bosta request failed with status ${response.status}.`;
    throw createHttpError(message, response.status, payload);
  }

  return payload;
}

export function isBostaConfigured() {
  return Boolean(normalizeBaseUrl(env.bostaApiBaseUrl) && String(env.bostaApiKey || "").trim());
}

export async function listBostaPickupLocations() {
  const payload = await bostaRequest("/pickup-locations");
  return extractPayloadArray(payload);
}

export async function listBostaCities() {
  const payload = await bostaRequest("/cities");
  return extractPayloadArray(payload);
}

export async function resolveBostaCityCode(cityName) {
  const normalizedName = String(cityName || "").trim().toLowerCase();
  if (!normalizedName) {
    return "";
  }

  const cities = await listBostaCities();
  const match = cities.find((city) => {
    const candidates = [city?.name, city?.displayName, city?.nameAr, city?.arabicName]
      .filter(Boolean)
      .map((item) => String(item).trim().toLowerCase());
    return candidates.includes(normalizedName);
  });

  return String(match?.code || match?._id || match?.id || "").trim();
}

export async function getBostaHealth() {
  if (!isBostaConfigured()) {
    return {
      configured: false,
      connected: false,
      baseUrl: normalizeBaseUrl(env.bostaApiBaseUrl),
      pickupLocationsCount: 0,
      pickupLocations: [],
    };
  }

  const pickupLocations = await listBostaPickupLocations();
  return {
    configured: true,
    connected: true,
    baseUrl: normalizeBaseUrl(env.bostaApiBaseUrl),
    pickupLocationsCount: pickupLocations.length,
    pickupLocations,
  };
}

function buildDropOffAddress(order, options = {}) {

  // =========================
  // BOSTA CITY IDS
  // =========================
  const cityMap = {

    // القاهرة
    "القاهرة": "FceDyHXwpSYYF9zGW",
    "القاهره": "FceDyHXwpSYYF9zGW",
    "cairo": "FceDyHXwpSYYF9zGW",

    // الجيزة
    "الجيزة": "0064Qb0OgcA",
    "الجيزه": "0064Qb0OgcA",
    "giza": "0064Qb0OgcA",

    // الإسكندرية
    "الاسكندرية": "Jrb6X6ucjiYgMP4T7",
    "الإسكندرية": "Jrb6X6ucjiYgMP4T7",
    "alexandria": "Jrb6X6ucjiYgMP4T7",

    // أسيوط
    "اسيوط": "7mDPAohM3ArSZmWTm",
    "أسيوط": "7mDPAohM3ArSZmWTm",
    "assiut": "7mDPAohM3ArSZmWTm",

    // أسوان
    "اسوان": "kLvZ5JY6LJPL5chzN",
    "أسوان": "kLvZ5JY6LJPL5chzN",
    "aswan": "kLvZ5JY6LJPL5chzN",

    // بني سويف
    "بني سويف": "LzbbvTzZ7D2CgE2PL",
    "beni suef": "LzbbvTzZ7D2CgE2PL",

    // البحيرة
    "البحيرة": "g3GchTSmCgR2JynsJ",
    "البحيره": "g3GchTSmCgR2JynsJ",
    "beheira": "g3GchTSmCgR2JynsJ",

    // الدقهلية
    "الدقهلية": "RrDhS8YYsXAwZ9Zfo",
    "الدقهليه": "RrDhS8YYsXAwZ9Zfo",
    "dakahlia": "RrDhS8YYsXAwZ9Zfo",

    // دمياط
    "دمياط": "qoZvYcZ8Cqji4pGp5",
    "damietta": "qoZvYcZ8Cqji4pGp5",

    // القليوبية
    "القليوبية": "yp3atroeTwnyiBNKE",
    "القليوبيه": "yp3atroeTwnyiBNKE",
    "qaliubia": "yp3atroeTwnyiBNKE",

    // الفيوم
    "الفيوم": "BW5MiNxEirB7tuz2y",
    "fayoum": "BW5MiNxEirB7tuz2y",

    // الغربية
    "الغربية": "K3RwC677J8kJytdZD",
    "الغربيه": "K3RwC677J8kJytdZD",
    "gharbia": "K3RwC677J8kJytdZD",

    // الإسماعيلية
    "الإسماعيلية": "PJqNriLtFtx2cfkKP",
    "الاسماعيليه": "PJqNriLtFtx2cfkKP",
    "ismailia": "PJqNriLtFtx2cfkKP",

    // كفر الشيخ
    "كفر الشيخ": "ByP7rFCjL6XzF6j4S",
    "kafr el sheikh": "ByP7rFCjL6XzF6j4S",

    // الأقصر
    "الأقصر": "wgYEdH2WMzxGE2Ztp",
    "الاقصر": "wgYEdH2WMzxGE2Ztp",
    "luxor": "wgYEdH2WMzxGE2Ztp",

    // مطروح
    "مطروح": "KBpGiRZJMIx",
    "matrouh": "KBpGiRZJMIx",

    // المنيا
    "المنيا": "si6eLnKjXqTFTMBj9",
    "minya": "si6eLnKjXqTFTMBj9",

    // المنوفية
    "المنوفية": "ruBSjGBDX9wpRa3cc",
    "المنوفيه": "ruBSjGBDX9wpRa3cc",
    "monufia": "ruBSjGBDX9wpRa3cc",

    // بورسعيد
    "بورسعيد": "skFtf6ZmKo8kBEBDK",
    "port said": "skFtf6ZmKo8kBEBDK",

    // قنا
    "قنا": "vfTHTes3uGjAszgtg",
    "qena": "vfTHTes3uGjAszgtg",

    // البحر الأحمر
    "البحر الأحمر": "r5TscLCNSjR2GimxQ",
    "البحر الاحمر": "r5TscLCNSjR2GimxQ",
    "red sea": "r5TscLCNSjR2GimxQ",

    // الشرقية
    "الشرقية": "6ExcoGbpYHnggP8JD",
    "الشرقيه": "6ExcoGbpYHnggP8JD",
    "sharqia": "6ExcoGbpYHnggP8JD",

    // سوهاج
    "سوهاج": "n3EENg2adhuR9xBZK",
    "sohag": "n3EENg2adhuR9xBZK",

    // السويس
    "السويس": "PickurJ5uJZ9rDTHW",
    "suez": "PickurJ5uJZ9rDTHW",
  };

  // =========================
  // CITY NAME
  // =========================

  const cityName = String(
    options.city ||
    order?.customerCity ||
    order?.shippingCity ||
    order?.city ||
    order?.address?.city ||
    "القاهرة"
  )
    .trim()
    .toLowerCase();

  // =========================
  // DISTRICT NAME
  // =========================

  const districtName = String(
    options.district ||
    order?.customerDistrict ||
    order?.shippingDistrict ||
    order?.district ||
    order?.address?.district ||
    (
      order?.customerAddress ||
      order?.shippingAddress ||
      order?.address?.street ||
      order?.address ||
      ""
    )
      .trim()
      .split(" ")
      .slice(-1)[0]
  ).trim();

  // =========================
  // ADDRESS LINES
  // =========================

  const firstLine = String(
    options.firstLine ||
    order?.customerAddress ||
    order?.shippingAddress ||
    order?.address?.street ||
    order?.address ||
    "شارع غير محدد"
  ).trim();

  const secondLine = String(
    options.secondLine ||
    order?.address2 ||
    ""
  ).trim();

  // =========================
  // BUILDING DETAILS
  // =========================

  const buildingNumber = String(
    options.buildingNumber ||
    order?.buildingNumber ||
    ""
  ).trim();

  const floor = String(
    options.floor ||
    order?.floor ||
    ""
  ).trim();

  const apartment = String(
    options.apartment ||
    order?.apartment ||
    ""
  ).trim();

  // =========================
  // CITY ID
  // =========================

  const cityId =
    cityMap[cityName] ||
    "FceDyHXwpSYYF9zGW";

  // =========================
  // FINAL OBJECT
  // =========================

  return {
    firstLine,
    secondLine,
    buildingNumber,
    floor,
    apartment,
    districtName,
    cityId,
  };
}
export async function createBostaShipmentFromOrder(order, options = {}) {
  if (!order) {
    throw createHttpError("Order is required to create a Bosta shipment.", 400);
  }

  const receiver = splitCustomerName(order.customerName);
  const cityCode =
    String(options.cityCode || "").trim()
    || String(env.bostaDefaultCityCode || "").trim()
    || (await resolveBostaCityCode(order.customerCity));

  if (!cityCode) {
    throw createHttpError(
      "Bosta city code could not be resolved automatically. Set BOSTA_DEFAULT_CITY_CODE or pass cityCode explicitly.",
      400,
    );
  }

  const payload = {
    type: 10,
    notes: String(options.notes || env.bostaDefaultNotes || order.customerNotes || "").trim(),
    cod: Number(order.total || 0),
    businessReference: String(order.orderNumber || "").trim(),
    receiver: {
      firstName: receiver.firstName,
      lastName: receiver.lastName,
      phone: String(order.customerPhone || "").trim(),
      email: String(order.customerEmail || "").trim(),
    },
    dropOffAddress: buildDropOffAddress(order),
  };

  if (env.bostaPickupLocationId) {
    payload.businessLocationId = env.bostaPickupLocationId;
  }
  if (env.bostaWebhookUrl) {
    payload.webhookUrl = env.bostaWebhookUrl;
  }
  if (env.bostaWebhookAuthKey) {
    payload.webhookAuthKey = env.bostaWebhookAuthKey;
  }

  const response = await bostaRequest("/deliveries?apiVersion=1", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return {
    raw: response,
    deliveryId: String(response?._id || response?.id || response?.deliveryId || "").trim(),
    trackingNumber: String(response?.trackingNumber || response?.tracking_number || response?.trackingCode || "").trim(),
    state: String(response?.state || response?.deliveryState || "created").trim(),
    payload,
  };
}

export async function trackBostaDelivery(deliveryId) {
  if (!deliveryId) {
    throw createHttpError("Delivery ID or tracking number is required to track Bosta shipment.", 400);
  }
  const payload = await bostaRequest(`/deliveries/${deliveryId}`);
  return {
    id: payload._id || payload.id,
    trackingNumber: payload.trackingNumber,
    state: payload.state?.value || payload.state || (payload.status ? payload.status.state : "unknown"),
    status: payload.status,
    history: payload.history || [],
    raw: payload
  };
}
