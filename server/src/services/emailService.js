import fs from "node:fs/promises";
import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { getRawDbPath } from "../data/db.js";
import { getSalesWorkbookPath } from "./excelAutoSaveService.js";

let transporter;
const FIXED_RECIPIENT = "mdiaad03@gmail.com";

export function isMailConfigured() {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass && env.mailFrom);
}

function createTransporter() {
  if (!isMailConfigured()) {
    return null;
  }
  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });
  return transporter;
}

function money(value, currency = "EGP") {
  const amount = Number(value || 0);
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
  return formatter.format(Number.isFinite(amount) ? amount : 0);
}

function orderStatusLabel(status) {
  return ({
    pending: "Pending",
    confirmed: "Confirmed",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
  })[String(status || "").toLowerCase()] || String(status || "Updated");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildOrderItemsMarkup(order, currency) {
  const items = Array.isArray(order?.items) ? order.items : [];
  return items
    .map((item) => {
      const name = escapeHtml(item?.laptopName || "Product");
      const quantity = Number(item?.quantity || 0);
      const total = money(item?.lineTotal, currency);
      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-weight:600;">${name}</td>
          <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;color:#475569;text-align:center;">${quantity}</td>
          <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;color:#f97316;text-align:right;font-weight:700;">${escapeHtml(total)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderMailShell({ eyebrow, title, intro, body, footerNote }) {
  return `
    <div style="margin:0;padding:32px 16px;background:#f8fafc;font-family:Arial,'Segoe UI',sans-serif;color:#0f172a;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:28px;overflow:hidden;box-shadow:0 28px 80px rgba(15,23,42,0.12);">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#0f172a 0%,#0f766e 52%,#f97316 100%);color:#ffffff;">
          <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;opacity:0.82;">${escapeHtml(eyebrow)}</div>
          <h1 style="margin:10px 0 0;font-size:30px;line-height:1.2;">${escapeHtml(title)}</h1>
          <p style="margin:12px 0 0;font-size:15px;line-height:1.7;max-width:560px;color:rgba(255,255,255,0.88);">${escapeHtml(intro)}</p>
        </div>
        <div style="padding:28px 32px;">
          ${body}
        </div>
        <div style="padding:18px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px;line-height:1.7;">
          ${escapeHtml(footerNote)}
        </div>
      </div>
    </div>
  `;
}

function renderOrderMeta({ order, currency, previousStatus }) {
  const rows = [
    ["Order number", order.orderNumber],
    ["Status", orderStatusLabel(order.status)],
    previousStatus ? ["Previous status", orderStatusLabel(previousStatus)] : null,
    ["Total", money(order.total, currency)],
    ["Payment", order.paymentMethod || "Cash on delivery"],
    ["Destination", [order.customerAddress, order.customerCity].filter(Boolean).join(", ") || "To be confirmed"],
    order.shippingCompanyName ? ["Shipping company", order.shippingCompanyName] : null,
    order.trackingNumber ? ["Tracking number", order.trackingNumber] : null,
    order.shippingStatus ? ["Shipping update", order.shippingStatus] : null,
  ].filter(Boolean);

  return `
    <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
      <tbody>
        ${rows
          .map(
            ([label, value]) => `
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;width:34%;">${escapeHtml(label)}</td>
                <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-weight:600;">${escapeHtml(value)}</td>
              </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

export async function sendTestEmail({ to, subject, body }) {
  const transport = createTransporter();
  if (!transport) {
    return { sent: false, reason: "mail_not_configured" };
  }

  const resolvedSubject = String(subject || "").trim() || "C2A LAP - Test Email";
  const resolvedBody =
    String(body || "").trim() ||
    "This is a test email from the C2A LAP administration panel. Your SMTP configuration is working correctly.";

  const html = renderMailShell({
    eyebrow: "C2A LAP | Test email",
    title: "Email integration is active",
    intro: "This message confirms that the configured SMTP provider can send messages from your server.",
    body: `
      <div style="padding:16px 18px;border:1px solid #e2e8f0;border-radius:18px;background:#f8fafc;color:#0f172a;line-height:1.9;">
        ${escapeHtml(resolvedBody)}
      </div>
    `,
    footerNote: "If you received this message, automated order and shipping emails are ready to be used.",
  });

  await transport.sendMail({
    from: env.mailFrom,
    to: FIXED_RECIPIENT,
    subject: resolvedSubject,
    text: resolvedBody,
    html,
  });

  return { sent: true };
}

export async function sendOrderPlacedEmail({ order }) {
  const transport = createTransporter();
  if (!transport) {
    return { sent: false, reason: "mail_not_configured" };
  }

  const currency = String(order.currency || "EGP").toUpperCase();
  const subject = `Order Received - ${order.orderNumber}`;
  const text = [
    `Hello ${order.customerName},`,
    `Your order ${order.orderNumber} has been received successfully.`,
    `Total: ${money(order.total, currency)}`,
    `Status: ${orderStatusLabel(order.status)}`,
    "",
    "Thank you for shopping with C2A LAP.",
  ].join("\n");

  const html = renderMailShell({
    eyebrow: "C2A LAP | Order received",
    title: "Your order is now in our system",
    intro: `Hello ${order.customerName}, your request was received successfully and is now being prepared by our team.`,
    body: `
      ${renderOrderMeta({ order, currency })}
      <div style="margin:20px 0 0;">
        <h3 style="margin:0 0 14px;font-size:18px;color:#0f172a;">Order items</h3>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="padding:0 0 10px;text-align:left;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.12em;">Item</th>
              <th style="padding:0 0 10px;text-align:center;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.12em;">Qty</th>
              <th style="padding:0 0 10px;text-align:right;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.12em;">Line total</th>
            </tr>
          </thead>
          <tbody>${buildOrderItemsMarkup(order, currency)}</tbody>
        </table>
      </div>
    `,
    footerNote: "You will receive another message when the order is shipped and once it is marked as delivered.",
  });

  await transport.sendMail({
    from: env.mailFrom,
    to: FIXED_RECIPIENT,
    subject,
    text,
    html,
  });

  return { sent: true };
}

export async function sendOrderStatusEmail({ order, previousStatus }) {
  const transport = createTransporter();
  if (!transport) {
    return { sent: false, reason: "mail_not_configured" };
  }

  const status = String(order.status || "").toLowerCase();
  if (!["shipped", "delivered", "confirmed", "cancelled"].includes(status)) {
    return { sent: false, reason: "status_not_supported" };
  }

  const currency = String(order.currency || "EGP").toUpperCase();
  const subject = `Order ${orderStatusLabel(status)} - ${order.orderNumber}`;

  const shippingDetails = [
    order.shippingCompanyName ? `Shipping company: ${order.shippingCompanyName}` : "",
    order.trackingNumber ? `Tracking number: ${order.trackingNumber}` : "",
    order.shippingStatus ? `Shipping status: ${order.shippingStatus}` : "",
  ].filter(Boolean);

  const text = [
    `Hello ${order.customerName},`,
    `Your order ${order.orderNumber} is now ${orderStatusLabel(status)}.`,
    previousStatus ? `Previous status: ${orderStatusLabel(previousStatus)}` : "",
    `Total: ${money(order.total, currency)}`,
    ...shippingDetails,
    "",
    "Thank you for shopping with C2A LAP.",
  ]
    .filter(Boolean)
    .join("\n");

  const statusIntro = {
    confirmed: "Your order has been confirmed and is moving to fulfillment.",
    shipped: "Your order is now with the shipping company and on its way.",
    delivered: "Your order has been marked as delivered. We hope everything arrived in perfect condition.",
    cancelled: "Your order has been cancelled. If this was unexpected, please contact support.",
  }[status] || "Your order status has been updated.";

  const html = renderMailShell({
    eyebrow: "C2A LAP | Order update",
    title: `Order ${orderStatusLabel(status)}`,
    intro: `Hello ${order.customerName}, ${statusIntro}`,
    body: `
      ${renderOrderMeta({ order, currency, previousStatus })}
      ${
        shippingDetails.length > 0
          ? `<div style="padding:16px 18px;border:1px solid #e2e8f0;border-radius:18px;background:#f8fafc;">
              <div style="margin:0 0 10px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">Shipping details</div>
              <ul style="margin:0;padding-left:18px;color:#0f172a;line-height:1.8;">
                ${shippingDetails.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
              </ul>
            </div>`
          : ""
      }
    `,
    footerNote: "Keep this email for reference until the order cycle is complete.",
  });

  await transport.sendMail({
    from: env.mailFrom,
    to: FIXED_RECIPIENT,
    subject,
    text,
    html,
  });

  return { sent: true };
}

export async function sendSupportTicketReceivedEmail({ ticket }) {
  const transport = createTransporter();
  if (!transport) {
    return { sent: false, reason: "mail_not_configured" };
  }

  const subject = `Support Ticket Received - ${ticket.id}`;
  const text = [
    `Hello ${ticket.customerName || "Customer"},`,
    "We have received your support ticket.",
    `Ticket ID: ${ticket.id}`,
    `Subject: ${ticket.subject}`,
    "",
    "Our team will reply as soon as possible.",
  ].join("\n");

  const html = renderMailShell({
    eyebrow: "C2A LAP | Support",
    title: "Support ticket received",
    intro: `Hello ${ticket.customerName || "Customer"}, we received your message and our team will follow up soon.`,
    body: `
      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;width:34%;">Ticket ID</td>
            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-weight:600;">${escapeHtml(ticket.id)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;">Subject</td>
            <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-weight:600;">${escapeHtml(ticket.subject)}</td>
          </tr>
        </tbody>
      </table>
    `,
    footerNote: "If you need to add more details, reply to this email or contact support from your account page.",
  });

  await transport.sendMail({
    from: env.mailFrom,
    to: FIXED_RECIPIENT,
    subject,
    text,
    html,
  });

  return { sent: true };
}

// ----------------------------------------------------
// New Stylized Email Notification Functions
// ----------------------------------------------------

export async function sendPaymentResultEmail({ order, success, transactionId, amount, details }) {
  const transport = createTransporter();
  if (!transport) {
    return { sent: false, reason: "mail_not_configured" };
  }

  const statusStr = success ? "SUCCESS" : "FAILED";
  const subject = `[Payment Alert] Paymob ${statusStr} - Order ${order?.orderNumber || "N/A"}`;
  
  const text = `Paymob Payment ${statusStr} for order ${order?.orderNumber || "N/A"}. Transaction ID: ${transactionId}. Amount: ${amount} EGP. Details: ${details || ""}`;
  
  const statusColor = success ? "#0f766e" : "#e11d48";
  
  const html = renderMailShell({
    eyebrow: `Paymob Transaction Status`,
    title: `Payment: ${statusStr}`,
    intro: `A Paymob transaction has been registered for order #${order?.orderNumber || "N/A"}.`,
    body: `
      <div style="border: 2px solid ${statusColor}; border-radius: 18px; padding: 20px; background: #ffffff;">
        <h3 style="margin-top: 0; color: ${statusColor}; font-size: 20px;">Transaction Details</h3>
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0; border-bottom:1px solid #f1f5f9; color:#64748b;">Order Number</td>
            <td style="padding:8px 0; border-bottom:1px solid #f1f5f9; font-weight:bold;">${escapeHtml(order?.orderNumber || "N/A")}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; border-bottom:1px solid #f1f5f9; color:#64748b;">Transaction ID</td>
            <td style="padding:8px 0; border-bottom:1px solid #f1f5f9; font-family:monospace; font-weight:bold;">${escapeHtml(transactionId || "N/A")}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; border-bottom:1px solid #f1f5f9; color:#64748b;">Amount Paid</td>
            <td style="padding:8px 0; border-bottom:1px solid #f1f5f9; font-weight:bold; color: #f97316;">${money(amount, "EGP")}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; border-bottom:1px solid #f1f5f9; color:#64748b;">Response Details</td>
            <td style="padding:8px 0; border-bottom:1px solid #f1f5f9; font-size: 13px;">${escapeHtml(details || "N/A")}</td>
          </tr>
        </table>
      </div>
    `,
    footerNote: "This is a direct transaction status verification alert from Paymob processor."
  });

  await transport.sendMail({
    from: env.mailFrom,
    to: FIXED_RECIPIENT,
    subject,
    text,
    html,
  });

  return { sent: true };
}

export async function sendShipmentCreatedEmail({ order, bostaOrder }) {
  const transport = createTransporter();
  if (!transport) {
    return { sent: false, reason: "mail_not_configured" };
  }

  const subject = `[Shipment Created] Order ${order?.orderNumber || "N/A"} dispatched to Bosta`;
  const trackingNumber = bostaOrder?.trackingNumber || "N/A";
  const trackingLink = `https://tracking.bosta.co/tracker/${trackingNumber}`;

  const text = `Shipment created via Bosta for order ${order?.orderNumber}. Tracking No: ${trackingNumber}. View details at: ${trackingLink}`;

  const html = renderMailShell({
    eyebrow: "Bosta Delivery Status",
    title: "Shipment Registered with Bosta",
    intro: `Order #${order?.orderNumber || "N/A"} has been processed and sent to Bosta courier service.`,
    body: `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 18px; padding: 24px; text-align: center;">
        <h3 style="margin-top: 0; color: #0f172a;">Your Shipment is Ready!</h3>
        <p style="font-size: 14px; color: #475569; margin-bottom: 20px;">Use the tracking number below to track your packages on Bosta.</p>
        <div style="display: inline-block; background: #ffffff; border: 1px dashed #cbd5e1; padding: 12px 24px; border-radius: 12px; font-size: 20px; font-weight: bold; letter-spacing: 2px; color: #0f766e; margin-bottom: 24px;">
          ${escapeHtml(trackingNumber)}
        </div>
        <div>
          <a href="${trackingLink}" target="_blank" style="display: inline-block; background: #f97316; color: #ffffff; font-weight: bold; padding: 12px 30px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 12px rgba(249,115,22,0.3);">
            Track Shipment on Bosta
          </a>
        </div>
      </div>
    `,
    footerNote: "Bosta delivers within 1-3 working days. Please have cash ready if this is a cash-on-delivery order."
  });

  await transport.sendMail({
    from: env.mailFrom,
    to: FIXED_RECIPIENT,
    subject,
    text,
    html,
  });

  return { sent: true };
}

export async function sendProductAddedEmail({ product }) {
  const transport = createTransporter();
  if (!transport) {
    return { sent: false, reason: "mail_not_configured" };
  }

  const subject = `[Catalog Alert] New Product Added: ${product?.laptopName || "Laptop"}`;
  const text = `New laptop added to catalog. Name: ${product?.laptopName}, Brand: ${product?.brand}, Price: ${product?.sellingPrice} EGP, Stock: ${product?.stock}`;

  const html = renderMailShell({
    eyebrow: "Inventory Catalog Sync",
    title: "New Laptop Added",
    intro: `A new device has been added to the store inventory database by administrative or AI operation.`,
    body: `
      <table style="width:100%; border-collapse:collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #e2e8f0; color:#64748b; width: 30%;">Brand</td>
          <td style="padding:10px 0; border-bottom:1px solid #e2e8f0; font-weight:bold;">${escapeHtml(product?.brand || "N/A")}</td>
        </tr>
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #e2e8f0; color:#64748b;">Model Name</td>
          <td style="padding:10px 0; border-bottom:1px solid #e2e8f0; font-weight:bold;">${escapeHtml(product?.laptopName || "N/A")}</td>
        </tr>
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #e2e8f0; color:#64748b;">Selling Price</td>
          <td style="padding:10px 0; border-bottom:1px solid #e2e8f0; font-weight:bold; color: #f97316;">${money(product?.sellingPrice, "EGP")}</td>
        </tr>
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #e2e8f0; color:#64748b;">Stock Quantity</td>
          <td style="padding:10px 0; border-bottom:1px solid #e2e8f0; font-weight:bold;">${escapeHtml(product?.stock ?? "0")} items</td>
        </tr>
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #e2e8f0; color:#64748b;">SKU Code</td>
          <td style="padding:10px 0; border-bottom:1px solid #e2e8f0; font-family:monospace; font-weight:bold;">${escapeHtml(product?.sku || "N/A")}</td>
        </tr>
      </table>
      ${product?.imageUrls && product.imageUrls.length > 0 ? `
        <div style="text-align: center; background: #f8fafc; border-radius: 18px; padding: 15px;">
          <img src="${product.imageUrls[0]}" alt="${escapeHtml(product?.laptopName)}" style="max-width: 260px; max-height: 180px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.06);" />
        </div>
      ` : ""}
    `,
    footerNote: "Automated alert from store inventory control center."
  });

  await transport.sendMail({
    from: env.mailFrom,
    to: FIXED_RECIPIENT,
    subject,
    text,
    html,
  });

  return { sent: true };
}

export async function sendLoginAlertEmail({ user, ip }) {
  const transport = createTransporter();
  if (!transport) {
    return { sent: false, reason: "mail_not_configured" };
  }

  const timestamp = new Date().toISOString();
  const subject = `[Security Alert] Successful Admin Login - ${user?.username || "Admin"}`;
  const text = `Admin login detected. Username: ${user?.username}, Role: ${user?.role}, IP: ${ip}, Time: ${timestamp}`;

  const html = renderMailShell({
    eyebrow: "Access Control Security",
    title: "Successful Admin Login Detected",
    intro: `A login event was registered for an administrative user. Please review this access to verify legitimacy.`,
    body: `
      <div style="border-left: 4px solid #f97316; padding-left: 20px; margin: 20px 0;">
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0; color:#64748b; width: 30%;">User ID</td>
            <td style="padding:8px 0; font-weight:bold;">${escapeHtml(user?.id || "N/A")}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; color:#64748b;">Username</td>
            <td style="padding:8px 0; font-weight:bold;">${escapeHtml(user?.username || "N/A")}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; color:#64748b;">Account Role</td>
            <td style="padding:8px 0; font-weight:bold; text-transform: capitalize;">${escapeHtml(user?.role || "N/A")}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; color:#64748b;">Source IP Address</td>
            <td style="padding:8px 0; font-family:monospace; font-weight:bold; color: #e11d48;">${escapeHtml(ip || "N/A")}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; color:#64748b;">Timestamp</td>
            <td style="padding:8px 0; font-size:13px; color:#475569;">${escapeHtml(timestamp)}</td>
          </tr>
        </table>
      </div>
    `,
    footerNote: "If this login was not made by you, please reset your password and check active sessions immediately."
  });

  await transport.sendMail({
    from: env.mailFrom,
    to: FIXED_RECIPIENT,
    subject,
    text,
    html,
  });

  return { sent: true };
}

export async function sendSystemEventEmail({ eventName, details, error }) {
  const transport = createTransporter();
  if (!transport) {
    return { sent: false, reason: "mail_not_configured" };
  }

  const subject = `[System Alert] ${eventName || "Exception Occurred"}`;
  const stack = error?.stack ? String(error.stack) : "";
  const message = error?.message ? String(error.message) : "";
  const detailsStr = typeof details === "object" ? JSON.stringify(details, null, 2) : String(details || "");

  const text = `System Event: ${eventName}. Message: ${message}. Details: ${detailsStr}\nStack: ${stack}`;

  const html = renderMailShell({
    eyebrow: "Application Telemetry",
    title: `Alert: ${escapeHtml(eventName)}`,
    intro: `An automated operation or exception event was caught and handled. Details below:`,
    body: `
      <div style="background: #0f172a; border-radius: 18px; padding: 20px; color: #38bdf8; font-family: Courier, monospace; font-size: 13px; overflow-x: auto; line-height: 1.6;">
        <div style="color: #f43f5e; font-weight: bold; margin-bottom: 10px;">[Event: ${escapeHtml(eventName)}]</div>
        ${message ? `<div style="color: #ffffff; margin-bottom: 10px;">Message: ${escapeHtml(message)}</div>` : ""}
        ${detailsStr ? `<div style="margin-bottom: 15px; border-bottom: 1px dashed #334155; padding-bottom: 10px; color: #94a3b8;">Details: <br/><pre style="margin: 5px 0;">${escapeHtml(detailsStr)}</pre></div>` : ""}
        ${stack ? `<div style="color: #e2e8f0; font-size: 11px;">Stack trace:<br/><pre style="margin: 5px 0; color: #cbd5e1; font-size:11px; white-space: pre-wrap; word-break: break-all;">${escapeHtml(stack)}</pre></div>` : ""}
      </div>
    `,
    footerNote: "Automated alert from exception logging middleware."
  });

  await transport.sendMail({
    from: env.mailFrom,
    to: FIXED_RECIPIENT,
    subject,
    text,
    html,
  });

  return { sent: true };
}

export async function sendSystemBackupEmail() {
  const transport = createTransporter();
  if (!transport) {
    console.warn("Mail is not configured. Automated backup email skipped.");
    return { sent: false, reason: "mail_not_configured" };
  }

  try {
    const dbPath = await getRawDbPath();
    const excelPath = getSalesWorkbookPath();

    const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    const subject = `[Automated Backup] C2A LAP System Backup - ${timestamp}`;
    const text = `Automated backup generated on ${timestamp}.\n\nAttached:\n1. Database backup (db.json)\n2. Sales workbook (sales_autosave.xlsx)`;

    const html = renderMailShell({
      eyebrow: "Automated Data Protection",
      title: "System Backup Successful",
      intro: "This email contains the automated database JSON file and the Excel sales workbook.",
      body: `
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 18px; padding: 20px; color: #166534; line-height: 1.8;">
          <strong>Data Backup Completed successfully!</strong>
          <p style="margin: 8px 0 0; font-size: 14px; color: #15803d;">
            The backup files have been generated and attached to this email. You can save them as a recovery point.
          </p>
        </div>
        <table style="width:100%; border-collapse:collapse; margin-top: 20px;">
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid #e2e8f0; color:#64748b; width: 30%;">Database File</td>
            <td style="padding:10px 0; border-bottom:1px solid #e2e8f0; font-family:monospace; font-weight:bold;">db.json</td>
          </tr>
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid #e2e8f0; color:#64748b;">Sales Sheet</td>
            <td style="padding:10px 0; border-bottom:1px solid #e2e8f0; font-family:monospace; font-weight:bold;">sales_autosave.xlsx</td>
          </tr>
          <tr>
            <td style="padding:10px 0; border-bottom:1px solid #e2e8f0; color:#64748b;">Timestamp</td>
            <td style="padding:10px 0; border-bottom:1px solid #e2e8f0; font-size: 13px;">${escapeHtml(timestamp)}</td>
          </tr>
        </table>
      `,
      footerNote: "Automated backup service powered by C2A LAP scheduler."
    });

    const attachments = [];
    try {
      await fs.access(dbPath);
      attachments.push({ filename: "db.json", path: dbPath });
    } catch (err) {
      console.error("Backup email failed to access db.json:", err.message);
    }

    try {
      await fs.access(excelPath);
      attachments.push({ filename: "sales_autosave.xlsx", path: excelPath });
    } catch (err) {
      console.error("Backup email failed to access sales_autosave.xlsx:", err.message);
    }

    await transport.sendMail({
      from: env.mailFrom,
      to: FIXED_RECIPIENT,
      subject,
      text,
      html,
      attachments,
    });

    console.log("Automated backup email sent successfully.");
    return { sent: true };
  } catch (error) {
    console.error("Automated backup email sending failed:", error);
    return { sent: false, error: error.message };
  }
}
