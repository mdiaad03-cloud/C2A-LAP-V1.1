import axios from "axios";
import { nanoid } from "nanoid";
import { getDb, saveDb } from "../data/db.js";
import { nowIso } from "../utils/dateUtils.js";
import { env } from "../config/env.js";
import {
  ORDER_STATUSES,
  buildOrderStatusHistory,
  createSalesFromOnlineOrder,
  ensureOnlineEmployee,
  restoreOrderStock,
} from "./onlineOrderService.js";
import { syncSalesWorkbook } from "./excelAutoSaveService.js";

async function syncSalesExcelSafe(sales) {
  try {
    await syncSalesWorkbook(sales);
  } catch (error) {
    console.error("WhatsApp sync sales excel failed:", error);
  }
}

// Clean phone numbers to compare them accurately
export function cleanPhone(phone) {
  return String(phone || "")
    .replace(/[^\d+]/g, "") // remove spaces, dashes, parentheses
    .replace(/^\+?20/, "0") // normalize Egyptian prefix (+2010... -> 010...)
    .replace(/^20/, "0");
}

// Format phone number for WhatsApp international format (Egyptian numbers)
export function formatForWhatsApp(phone) {
  let cleaned = String(phone || "").replace(/[^\d+]/g, "");
  // Remove leading + if present
  cleaned = cleaned.replace(/^\+/, "");
  // Egyptian local format: 01xxxxxxxxx -> 201xxxxxxxxx
  if (/^0\d{10}$/.test(cleaned)) {
    cleaned = "2" + cleaned;
  }
  // Already in 201... format
  if (/^20\d{10}$/.test(cleaned)) {
    return cleaned;
  }
  return cleaned;
}

async function sendViaUltraMsg(phone, text) {
  const instanceId = env.ultramsgInstanceId;
  const token = env.ultramsgToken;
  if (!instanceId || !token) {
    return null; // No credentials, skip real sending
  }
  try {
    const whatsappPhone = formatForWhatsApp(phone);
    const response = await axios.post(
      `https://api.ultramsg.com/${instanceId}/messages/chat`,
      {
        token,
        to: whatsappPhone,
        body: text,
      },
      { timeout: 15000 }
    );
    console.log(`[UltraMsg] Message sent to ${whatsappPhone}:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`[UltraMsg] Failed to send to ${phone}:`, error?.response?.data || error.message);
    return null;
  }
}

export async function sendWhatsAppMessage(phone, text, orderId = null) {
  const db = await getDb();
  db.whatsappLogs = db.whatsappLogs || [];

  const message = {
    id: nanoid(),
    phone: cleanPhone(phone),
    rawPhone: phone,
    text,
    direction: "outgoing",
    createdAt: nowIso(),
    orderId,
  };

  db.whatsappLogs.unshift(message);
  db.whatsappLogs = db.whatsappLogs.slice(0, 1000);
  await saveDb();

  // Try to send via UltraMsg if credentials are configured
  const ultraResult = await sendViaUltraMsg(phone, text);
  if (!ultraResult) {
    // Fallback: Print to server console for simulation debugging
    console.log(`\n--- [WhatsApp Bot Sent to ${phone}] ---\n${text}\n---------------------------------------\n`);
  }

  return message;
}

export async function sendOrderConfirmationMessage(order) {
  const paymentLabel = order.paymentMethod === "cash_on_delivery" ? "الدفع عند الاستلام 💵" : "تم الدفع إلكترونياً 💳";
  const itemsList = (order.items || [])
    .map((item, i) => `  ${i + 1}. ${item.laptopName || item.name || "منتج"} × ${item.quantity}`)
    .join("\n");

  const messageText = `━━━━━━━━━━━━━━━━━
🛒 *طلب جديد من C2A LAP*
━━━━━━━━━━━━━━━━━

مرحباً *${order.customerName}* 👋

تم استلام طلبك بنجاح! ✅

📋 *تفاصيل الطلب:*
▫️ رقم الطلب: *${order.orderNumber}*
▫️ طريقة الدفع: ${paymentLabel}

🛍️ *المنتجات:*
${itemsList}

💰 *الإجمالي: ${Number(order.total).toLocaleString("ar-EG")} ج.م*

━━━━━━━━━━━━━━━━━
📌 *لتأكيد الطلب:*
    أرسل *1* أو اكتب *تأكيد*

❌ *لإلغاء الطلب:*
    أرسل *2* أو اكتب *إلغاء*
━━━━━━━━━━━━━━━━━

⏳ سيتم إلغاء الطلب تلقائياً في حال عدم التأكيد خلال 24 ساعة.
شكراً لثقتك بنا! 💙`;

  return sendWhatsAppMessage(order.customerPhone, messageText, order.id);
}

export async function receiveCustomerReply(phone, text) {
  const db = await getDb();
  db.whatsappLogs = db.whatsappLogs || [];

  const cleanedIncomingPhone = cleanPhone(phone);
  const normalizedText = String(text || "").trim().toLowerCase();

  // 1. Log incoming message
  const incomingMsg = {
    id: nanoid(),
    phone: cleanedIncomingPhone,
    rawPhone: phone,
    text,
    direction: "incoming",
    createdAt: nowIso(),
  };
  db.whatsappLogs.unshift(incomingMsg);

  // 2. Find the latest pending order for this customer phone
  const order = db.onlineOrders.find((o) => {
    return cleanPhone(o.customerPhone) === cleanedIncomingPhone && o.status === ORDER_STATUSES.pending;
  });

  let replyText = "";
  let orderUpdated = false;

  if (order) {
    const isConfirm = ["1", "تأكيد", "تاكيد", "yes", "confirm", "نعم", "تأكيد الطلب"].includes(normalizedText);
    const isCancel = ["2", "إلغاء", "الغاء", "no", "cancel", "إلغاء الطلب"].includes(normalizedText);

    if (isConfirm) {
      // Transition to confirmed
      order.status = ORDER_STATUSES.confirmed;
      order.statusHistory = order.statusHistory || [];
      order.statusHistory.unshift(
        buildOrderStatusHistory(ORDER_STATUSES.confirmed, { id: "whatsapp_bot", name: "WhatsApp Bot" })
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
        title: `Order ${order.orderNumber} confirmed via WhatsApp`,
        message: `Customer ${order.customerName} confirmed their order via WhatsApp reply.`,
        createdAt: nowIso(),
        createdBy: "whatsapp_bot",
        createdByName: "WhatsApp Bot",
      });
      db.notifications = db.notifications.slice(0, 200);

      orderUpdated = true;
      replyText = `تم تأكيد طلبك رقم ${order.orderNumber} بنجاح! 🎉 سنقوم بتجهيزه وشحنه إليك في أقرب وقت. شكراً لثقتك بنا!`;

      await saveDb();
      if (salesChanged) {
        await syncSalesExcelSafe(db.sales);
      }
    } else if (isCancel) {
      // Cancel the order
      order.status = ORDER_STATUSES.cancelled;
      order.statusHistory = order.statusHistory || [];
      order.statusHistory.unshift(
        buildOrderStatusHistory(ORDER_STATUSES.cancelled, { id: "whatsapp_bot", name: "WhatsApp Bot" })
      );

      if (!order.stockRestoredAt) {
        restoreOrderStock(db, order);
        order.stockRestoredAt = nowIso();
      }
      order.cancelledAt = nowIso();
      order.shippingStatus = "cancelled";
      order.updatedAt = nowIso();

      db.notifications.unshift({
        id: nanoid(),
        title: `Order ${order.orderNumber} cancelled via WhatsApp`,
        message: `Customer ${order.customerName} cancelled their order via WhatsApp reply.`,
        createdAt: nowIso(),
        createdBy: "whatsapp_bot",
        createdByName: "WhatsApp Bot",
      });
      db.notifications = db.notifications.slice(0, 200);

      orderUpdated = true;
      replyText = `تم إلغاء طلبك رقم ${order.orderNumber} بناءً على طلبك. نأمل أن نخدمك في المرة القادمة.`;

      await saveDb();
    } else {
      replyText = `لم نتمكن من فهم ردك. عذراً!
لتأكيد طلبك رقم ${order.orderNumber}، أرسل "1" أو "تأكيد".
لإلغاء الطلب، أرسل "2" أو "إلغاء".`;
    }
  } else {
    // Check if they have ANY order
    const anyOrder = db.onlineOrders.find((o) => cleanPhone(o.customerPhone) === cleanedIncomingPhone);
    if (anyOrder) {
      replyText = `مرحباً بك! لا توجد طلبات معلقة (Pending) بانتظار التأكيد حالياً لرقم الهاتف هذا.
آخر طلب لك رقم ${anyOrder.orderNumber} حالته الحالية هي: ${anyOrder.status}.`;
    } else {
      replyText = `أهلاً بك في C2A LAP! 💻
رقم الهاتف هذا غير مرتبط بأي طلبات نشطة حالياً. لتصفح منتجاتنا، يرجى زيارة موقعنا الإلكتروني.`;
    }
  }

  // Save outgoing bot reply
  const outgoingMsg = {
    id: nanoid(),
    phone: cleanedIncomingPhone,
    rawPhone: phone,
    text: replyText,
    direction: "outgoing",
    createdAt: nowIso(),
    orderId: order?.id || null,
  };
  db.whatsappLogs.unshift(outgoingMsg);
  db.whatsappLogs = db.whatsappLogs.slice(0, 1000);
  await saveDb();

  console.log(`\n--- [WhatsApp Bot Reply to ${phone}] ---\n${replyText}\n-----------------------------------------\n`);

  return {
    order: orderUpdated ? order : null,
    reply: outgoingMsg,
  };
}

export async function sendOrderStatusMessage(order, previousStatus) {
  const status = String(order.status || "").toLowerCase();
  let messageText = "";

  if (status === "confirmed") {
    messageText = `━━━━━━━━━━━━━━━━━
✅ *تأكيد الطلب - C2A LAP*
━━━━━━━━━━━━━━━━━

مرحباً *${order.customerName}* 👋

تم تأكيد طلبك بنجاح! 🎉

📋 رقم الطلب: *${order.orderNumber}*
💰 الإجمالي: *${Number(order.total).toLocaleString("ar-EG")} ج.م*

📦 جاري تجهيز طلبك للشحن وسنعلمك فور إرساله.

شكراً لثقتك بنا! 💙`;

  } else if (status === "shipped") {
    const carrierLine = order.shippingCompanyName ? `\n🏢 شركة الشحن: *${order.shippingCompanyName}*` : "";
    const trackingLine = order.trackingNumber ? `\n🔢 رقم التتبع: *${order.trackingNumber}*` : "";
    const trackingUrl = order.trackingNumber ? `\n🔗 تتبع شحنتك:\nhttps://bosta.co/tracking-shipment/?track_num=${order.trackingNumber}` : "";

    messageText = `━━━━━━━━━━━━━━━━━
🚚 *تم شحن طلبك - C2A LAP*
━━━━━━━━━━━━━━━━━

مرحباً *${order.customerName}* 👋

طلبك رقم *${order.orderNumber}* في الطريق إليك! 📦${carrierLine}${trackingLine}${trackingUrl}

━━━━━━━━━━━━━━━━━
نشكرك لتسوقك معنا! 💙`;

  } else if (status === "delivered") {
    messageText = `━━━━━━━━━━━━━━━━━
📦 *تم التوصيل - C2A LAP*
━━━━━━━━━━━━━━━━━

مرحباً *${order.customerName}* 👋

تم توصيل طلبك رقم *${order.orderNumber}* بنجاح! 🎉

نتمنى أن تنال منتجاتنا رضاكم ⭐
لو عندك أي استفسار، تواصل معنا في أي وقت.

━━━━━━━━━━━━━━━━━
شكراً لاختيارك *C2A LAP*! 💻💙`;

  } else if (status === "cancelled") {
    messageText = `━━━━━━━━━━━━━━━━━
❌ *إلغاء طلب - C2A LAP*
━━━━━━━━━━━━━━━━━

مرحباً *${order.customerName}* 👋

تم إلغاء طلبك رقم *${order.orderNumber}*.

لو الإلغاء غير مقصود أو عندك أي استفسار، تواصل معنا وهنساعدك فوراً.

━━━━━━━━━━━━━━━━━
فريق *C2A LAP* 💙`;

  } else {
    return null;
  }

  return sendWhatsAppMessage(order.customerPhone, messageText, order.id);
}
