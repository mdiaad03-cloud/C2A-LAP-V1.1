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

export const DEFAULT_TEMPLATES = {
  order_confirmation: `━━━━━━━━━━━━━━━━━
🛒 *طلب جديد من C2A LAP*
━━━━━━━━━━━━━━━━━

مرحباً *{customerName}* 👋

تم استلام طلبك بنجاح! ✅

📋 *تفاصيل الطلب:*
▫️ رقم الطلب: *{orderNumber}*
▫️ طريقة الدفع: {paymentLabel}

🛍️ *المنتجات:*
{itemsList}

💰 *الإجمالي: {total} ج.م*

━━━━━━━━━━━━━━━━━
📦 سنقوم بالتواصل معك قريباً لتأكيد طلبك وتجهيز الشحن.
━━━━━━━━━━━━━━━━━

شكراً لثقتك بنا! 💙`,

  order_confirmation_instapay: `━━━━━━━━━━━━━━━━━
⚡ *طلب جديد من C2A LAP (تحويل انستا باي)*
━━━━━━━━━━━━━━━━━

مرحباً *{customerName}* 👋

تم استلام طلبك بنجاح! ✅

📋 *تفاصيل الطلب:*
▫️ رقم الطلب: *{orderNumber}*
▫️ طريقة الدفع: تحويل انستا باي ⚡

🛍️ *المنتجات:*
{itemsList}

💰 *الإجمالي: {total} ج.م*

━━━━━━━━━━━━━━━━━
📌 *خطوات إتمام الدفع وتأكيد الطلب:*
1️⃣ يرجى تحويل المبلغ الإجمالي *{total} ج.م* عبر تطبيق انستا باي:
💰 عنوان الدفع (Address): *{instapayAddress}*
🔗 رابط الدفع المباشر: {instapayLink}

2️⃣ بعد إتمام التحويل بنجاح، *يرجى إرسال صورة / لقطة شاشة (Screenshot) للتحويل في هذا الشات لتأكيد طلبك وتجهيز الشحن فوراً.* 📸
━━━━━━━━━━━━━━━━━

شكراً لثقتك بنا! 💙`,

  order_confirmed: `━━━━━━━━━━━━━━━━━
✅ *تأكيد الطلب - C2A LAP*
━━━━━━━━━━━━━━━━━

مرحباً *{customerName}* 👋

تم تأكيد طلبك بنجاح! 🎉

📋 رقم الطلب: *{orderNumber}*
💰 الإجمالي: *{total} ج.م*

📦 جاري تجهيز طلبك للشحن وسنعلمك فور إرساله.

شكراً لثقتك بنا! 💙`,

  order_shipped: `━━━━━━━━━━━━━━━━━
🚚 *تم شحن طلبك - C2A LAP*
━━━━━━━━━━━━━━━━━

مرحباً *{customerName}* 👋

طلبك رقم *{orderNumber}* في الطريق إليك! 📦
{carrierLine}
{trackingLine}
{trackingUrlLine}

━━━━━━━━━━━━━━━━━
نشكرك لتسوقك معنا! 💙`,

  order_delivered: `━━━━━━━━━━━━━━━━━
📦 *تم التوصيل - C2A LAP*
━━━━━━━━━━━━━━━━━

مرحباً *{customerName}* 👋

تم توصيل طلبك رقم *{orderNumber}* بنجاح! 🎉

نتمنى أن تنال منتجاتنا رضاكم ⭐
لو عندك أي استفسار، تواصل معنا في أي وقت.

━━━━━━━━━━━━━━━━━
شكراً لاختيارك *C2A LAP*! 💻💙`,

  order_cancelled: `━━━━━━━━━━━━━━━━━
❌ *إلغاء طلب - C2A LAP*
━━━━━━━━━━━━━━━━━

مرحباً *{customerName}* 👋

تم إلغاء طلبك رقم *{orderNumber}*.

لو الإلغاء غير مقصود أو عندك أي استفسار، تواصل معنا وهنساعدك فوراً.

━━━━━━━━━━━━━━━━━
فريق *C2A LAP* 💙`
};

export function replaceTemplateVariables(template, order, instapayAddress = "", instapayLink = "") {
  let paymentLabel = "الدفع عند الاستلام 💵";
  if (order.paymentMethod === "paymob_egypt") {
    paymentLabel = "تم الدفع إلكترونياً 💳";
  } else if (order.paymentMethod === "instapay") {
    paymentLabel = "تحويل انستا باي ⚡";
  }

  const itemsList = (order.items || [])
    .map((item, i) => `  ${i + 1}. ${item.laptopName || item.name || "منتج"} × ${item.quantity}`)
    .join("\n");
  
  const totalStr = Number(order.total || 0).toLocaleString("ar-EG");
  
  const carrierLine = order.shippingCompanyName ? `🏢 شركة الشحن: *${order.shippingCompanyName}*` : "";
  const trackingLine = order.trackingNumber ? `🔢 رقم التتبع: *${order.trackingNumber}*` : "";
  const trackingUrlLine = order.trackingNumber ? `🔗 تتبع شحنتك:\nhttps://tracking.bosta.co/tracker/${order.trackingNumber}` : "";

  return template
    .replace(/{customerName}/g, order.customerName || "")
    .replace(/{orderNumber}/g, order.orderNumber || "")
    .replace(/{paymentLabel}/g, paymentLabel)
    .replace(/{itemsList}/g, itemsList)
    .replace(/{total}/g, totalStr)
    .replace(/{instapayAddress}/g, instapayAddress || "")
    .replace(/{instapayLink}/g, instapayLink || "")
    .replace(/{carrierLine}/g, carrierLine)
    .replace(/{trackingLine}/g, trackingLine)
    .replace(/{trackingUrlLine}/g, trackingUrlLine);
}

export async function sendWhatsAppAdminAlert(messageText) {
  try {
    const { sendAdminAlertEmail } = await import("./emailService.js");
    
    let subject = "تنبيه النظام - C2A LAP Alert";
    if (messageText.includes("تأكيد") || messageText.includes("تاكيد")) {
      subject = "تأكيد طلب جديد أونلاين ✅ - C2A LAP";
    } else if (messageText.includes("إلغاء") || messageText.includes("الغاء")) {
      subject = "إلغاء طلب أونلاين ❌ - C2A LAP";
    } else if (messageText.includes("تحديث") || messageText.includes("حالة")) {
      subject = "تحديث حالة طلب أونلاين 🔄 - C2A LAP";
    }

    const cleanText = messageText.replace(/\*/g, "");
    await sendAdminAlertEmail({
      subject,
      message: cleanText,
    });
    console.log("[Admin Alert] Notification email sent successfully to mdiaad03@gmail.com");
  } catch (err) {
    console.error("[Admin Alert] Failed to send email alert to admin:", err.message);
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
  const db = await getDb();
  let templateKey = "order_confirmation";
  if (order.paymentMethod === "instapay") {
    templateKey = "order_confirmation_instapay";
  }
  const template = db.whatsappTemplates?.[templateKey] || DEFAULT_TEMPLATES[templateKey];
  const instapayAddress = db.storeSettings?.features?.instapayAddress || "mdiaad003@instapay";
  const instapayLink = db.storeSettings?.features?.instapayLink || "https://ipn.eg/S/mdiaad003/instapay/3ZmQsm";
  const messageText = replaceTemplateVariables(template, order, instapayAddress, instapayLink);
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

      // Notify admin about automatic confirmation
      const adminAlertText = `✅ *تم تأكيد الطلب من العميل تلقائياً*
📋 طلب رقم: *${order.orderNumber}*
👤 العميل: *${order.customerName}*
📞 هاتف: *${order.customerPhone}*
💰 الإجمالي: *${Number(order.total).toLocaleString("ar-EG")} ج.م*`;
      await sendWhatsAppAdminAlert(adminAlertText);

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

      // Notify admin about automatic cancellation
      const adminAlertText = `❌ *تم إلغاء الطلب من العميل تلقائياً*
📋 طلب رقم: *${order.orderNumber}*
👤 العميل: *${order.customerName}*
📞 هاتف: *${order.customerPhone}*
💰 الإجمالي: *${Number(order.total).toLocaleString("ar-EG")} ج.م*`;
      await sendWhatsAppAdminAlert(adminAlertText);

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
  const db = await getDb();
  let templateKey = "";

  // WhatsApp messages to customer are ONLY sent for confirmation and cancellation.
  if (status === "confirmed") templateKey = "order_confirmed";
  else if (status === "cancelled") templateKey = "order_cancelled";

  let result = null;
  if (templateKey) {
    const template = db.whatsappTemplates?.[templateKey] || DEFAULT_TEMPLATES[templateKey];
    const instapayAddress = db.storeSettings?.features?.instapayAddress || "mdiaad003@instapay";
    const instapayLink = db.storeSettings?.features?.instapayLink || "https://ipn.eg/S/mdiaad003/instapay/3ZmQsm";
    const messageText = replaceTemplateVariables(template, order, instapayAddress, instapayLink);

    // Send message to customer
    result = await sendWhatsAppMessage(order.customerPhone, messageText, order.id);
  }

  // Send status alert to admin (sent to admin email)
  const statusLabels = {
    pending: "معلق ⏳",
    confirmed: "مؤكد ✅",
    shipped: "تم الشحن 🚚",
    delivered: "تم التسليم 📦",
    cancelled: "ملغي ❌",
  };
  const currentLabel = statusLabels[status] || status;
  const prevLabel = statusLabels[previousStatus] || previousStatus;

  const adminAlertText = `🔄 *تحديث حالة الطلب*
📋 طلب رقم: *${order.orderNumber}*
👤 العميل: *${order.customerName}*
📞 هاتف: *${order.customerPhone}*
📈 الحالة: *${prevLabel}* 👈 *${currentLabel}*
💰 الإجمالي: *${Number(order.total).toLocaleString("ar-EG")} ج.م*`;
  await sendWhatsAppAdminAlert(adminAlertText);

  return result;
}

export async function autoConfigureUltraMsgWebhook() {
  const instanceId = env.ultramsgInstanceId;
  const token = env.ultramsgToken;
  let storeBaseUrl = env.storeBaseUrl || "";
  if (!storeBaseUrl || storeBaseUrl.includes("localhost") || storeBaseUrl.includes("127.0.0.1")) {
    storeBaseUrl = "https://c2a-lap-v11-production.up.railway.app";
  }
  
  if (!instanceId || !token) {
    console.log("[UltraMsg Webhook] Skipping auto-configuration: Credentials not fully set.");
    return;
  }
  
  const webhookUrl = `${storeBaseUrl}/api/whatsapp/webhook`;
  console.log(`[UltraMsg Webhook] Auto-configuring webhook URL: ${webhookUrl}...`);
  
  try {
    const response = await axios.post(
      `https://api.ultramsg.com/${instanceId}/instance/settings`,
      {
        token,
        webhook_url: webhookUrl,
        webhook_message_received: "true",
        webhook_message_create: "false",
        webhook_message_ack: "false",
      },
      { timeout: 15000 }
    );
    console.log("[UltraMsg Webhook] ✅ Webhook auto-configured successfully:", response.data);
  } catch (error) {
    console.error("[UltraMsg Webhook] ❌ Failed to auto-configure webhook:", error?.response?.data || error.message);
  }
}
