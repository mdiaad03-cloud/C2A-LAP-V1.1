import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let transporter;

function isMailConfigured() {
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

export async function sendOrderPlacedEmail({ order }) {
  if (!order?.customerEmail) {
    return { sent: false, reason: "missing_email" };
  }

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
    to: order.customerEmail,
    subject,
    text,
    html,
  });

  return { sent: true };
}

export async function sendOrderStatusEmail({ order, previousStatus }) {
  if (!order?.customerEmail) {
    return { sent: false, reason: "missing_email" };
  }

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
    to: order.customerEmail,
    subject,
    text,
    html,
  });

  return { sent: true };
}

export async function sendSupportTicketReceivedEmail({ ticket }) {
  const toEmail = String(ticket?.customerEmail || "").trim();
  if (!toEmail) {
    return { sent: false, reason: "missing_email" };
  }

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
    to: toEmail,
    subject,
    text,
    html,
  });

  return { sent: true };
}
