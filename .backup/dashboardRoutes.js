import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate, csrfProtect } from "../middleware/auth.js";
import { getDb } from "../data/db.js";
import { applySaleFilters, buildDashboardCards } from "../services/analyticsService.js";

const router = Router();

router.use(authenticate, csrfProtect);

router.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const db = await getDb();

    const visibleSales = req.user.role === "admin"
      ? db.sales
      : db.sales.filter((sale) => sale.createdBy === req.user.id);

    const filteredSales = applySaleFilters(visibleSales, {
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      brand: req.query.brand,
      employee: req.query.employee,
      warrantyStatus: req.query.warrantyStatus,
      query: req.query.query,
    });

    const cards = buildDashboardCards({
      sales: filteredSales,
      contacts: db.contacts,
      users: db.users,
      products: db.products,
      onlineOrders: db.onlineOrders,
      role: req.user.role,
    });

    // 1. Build a comprehensive system activity timeline
    const timeline = [];

    // Order Creation and Status Updates
    for (const order of db.onlineOrders || []) {
      timeline.push({
        id: `order-created-${order.id}`,
        type: "order_created",
        title: "Order Placed",
        titleAr: "تم تقديم طلب جديد",
        description: `Order ${order.orderNumber} placed by ${order.customerName} for ${order.total} EGP`,
        descriptionAr: `تم تقديم طلب ${order.orderNumber} بواسطة ${order.customerName} بقيمة ${order.total} ج.م`,
        timestamp: order.createdAt || order.updatedAt,
        meta: { orderNumber: order.orderNumber, orderId: order.id }
      });

      if (Array.isArray(order.statusHistory)) {
        for (const history of order.statusHistory) {
          timeline.push({
            id: `order-status-${order.id}-${history.status}-${history.changedAt}`,
            type: "order_status",
            title: `Order Status: ${history.status}`,
            titleAr: `حالة الطلب: ${history.status}`,
            description: `Order ${order.orderNumber} status changed to "${history.status}" by ${history.changedByName || "System"}`,
            descriptionAr: `تغيرت حالة الطلب ${order.orderNumber} إلى "${history.status}" بواسطة ${history.changedByName || "النظام"}`,
            timestamp: history.changedAt,
            meta: { orderNumber: order.orderNumber, orderId: order.id, status: history.status }
          });
        }
      }
    }

    // Support Tickets Creation and Replies
    for (const ticket of db.supportTickets || []) {
      timeline.push({
        id: `ticket-created-${ticket.id}`,
        type: "support_created",
        title: "Support Ticket Opened",
        titleAr: "تم فتح تذكرة دعم فني",
        description: `Ticket #${ticket.id.slice(0, 6)} "${ticket.subject}" opened by ${ticket.customerName}`,
        descriptionAr: `تم فتح التذكرة #${ticket.id.slice(0, 6)} "${ticket.subject}" بواسطة ${ticket.customerName}`,
        timestamp: ticket.createdAt,
        meta: { ticketId: ticket.id, subject: ticket.subject }
      });

      if (Array.isArray(ticket.messages)) {
        // Skip first message since that's ticket creation
        for (let i = 1; i < ticket.messages.length; i++) {
          const msg = ticket.messages[i];
          timeline.push({
            id: `ticket-reply-${ticket.id}-${msg.id}`,
            type: "support_reply",
            title: "Support Reply",
            titleAr: "رد دعم فني",
            description: `New reply from ${msg.senderName} (${msg.senderRole}) on ticket "${ticket.subject}"`,
            descriptionAr: `رد جديد من ${msg.senderName} (${msg.senderRole}) على التذكرة "${ticket.subject}"`,
            timestamp: msg.createdAt,
            meta: { ticketId: ticket.id, senderRole: msg.senderRole }
          });
        }
      }
    }

    // Sales Record Additions
    for (const sale of db.sales || []) {
      timeline.push({
        id: `sale-created-${sale.id}`,
        type: "sale_created",
        title: "Sale Recorded",
        titleAr: "تم تسجيل عملية بيع",
        description: `Recorded sale of ${sale.laptopName} to ${sale.clientName} (${sale.sellingPrice} EGP)`,
        descriptionAr: `تم تسجيل بيع لابتوب ${sale.laptopName} للعميل ${sale.clientName} بقيمة ${sale.sellingPrice} ج.م`,
        timestamp: sale.createdAt || sale.purchaseDate,
        meta: { saleId: sale.id, laptopName: sale.laptopName }
      });
    }

    // Sort timeline and take top 20 recent events
    timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const recentTimeline = timeline.slice(0, 25);

    // 2. Fetch AI Operations Logs
    const aiLogs = (db.logs || [])
      .filter((log) => log.module === "agent" || log.details?.toLowerCase().includes("ai") || log.action?.toLowerCase().includes("ai"))
      .slice(0, 25);

    // 3. Fetch Shipping tracking info for shipped/delivered/active online orders
    const shipments = (db.onlineOrders || [])
      .filter((order) => order.trackingNumber || order.shippingCompanyName)
      .map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        carrier: order.shippingCompanyName || "Bosta",
        trackingNumber: order.trackingNumber || "",
        shippingStatus: order.shippingStatus || "pending",
        orderStatus: order.status,
        total: order.total,
        updatedAt: order.updatedAt || order.createdAt,
        bostaDeliveryId: order.bostaDeliveryId || ""
      }))
      .slice(0, 25);

    res.json({
      role: req.user.role,
      ...cards,
      timeline: recentTimeline,
      aiLogs,
      shipments,
    });
  }),
);

export default router;
