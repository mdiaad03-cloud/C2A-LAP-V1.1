import { useState } from "react";
import toast from "react-hot-toast";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BadgeDollarSign,
  Boxes,
  FileCheck,
  Globe,
  ShieldAlert,
  ShoppingCart,
  Users,
  Bot,
  RefreshCw,
  MessageSquare,
  Info,
  Truck,
} from "lucide-react";
import api from "../lib/api";
import KpiCard from "../components/KpiCard";
import { money, number } from "../utils/format";

export default function DashboardSection({ overview, isAdmin, lang = "en", onOpenProduct, onRefresh }) {
  const kpis = overview?.kpis || {};
  const charts = overview?.charts || {};
  const isArabic = lang === "ar";
  const tr = (en, ar) => (isArabic ? ar : en);
  const bestSellingProducts = charts.bestSellingProducts || [];
  const lowStockProducts = charts.lowStockProducts || [];

  const [syncingId, setSyncingId] = useState("");

  async function handleSyncStatus(orderId) {
    if (syncingId) return;
    setSyncingId(orderId);
    try {
      const res = await api.post(`/shipping/providers/bosta/orders/${orderId}/sync-status`);
      if (res.data?.success) {
        toast.success(isArabic ? "تم تحديث حالة الشحنة بنجاح." : "Shipment status synchronized.");
        onRefresh?.();
      } else {
        toast.error(res.data?.message || "Sync failed.");
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message || "Failed to sync status.");
    } finally {
      setSyncingId("");
    }
  }

  const cards = [
    {
      title: tr("Sales Records", "سجلات المبيعات"),
      value: number.format(kpis.totalSalesRecords || 0),
      hint: tr("All tracked transactions", "كل العمليات المسجلة"),
      icon: FileCheck,
      accent: "orange",
    },
    {
      title: tr("Products", "المنتجات"),
      value: number.format(kpis.totalProducts || 0),
      hint: tr("Catalog size", "حجم الكتالوج"),
      icon: Boxes,
      accent: "blue",
    },
    {
      title: tr("Contacts", "العملاء"),
      value: number.format(kpis.totalContacts || 0),
      hint: tr("Clients in CRM", "العملاء في إدارة العلاقات"),
      icon: Users,
      accent: "green",
    },
    {
      title: tr("Active Warranty", "ضمان ساري"),
      value: number.format(kpis.activeWarrantyCount || 0),
      hint: tr("Still covered", "مازال تحت الضمان"),
      icon: ShieldAlert,
      accent: "purple",
    },
    {
      title: tr("Expiring Soon", "ينتهي قريبًا"),
      value: number.format(kpis.expiringSoonCount || 0),
      hint: tr("Within 30 days", "خلال 30 يوم"),
      icon: Activity,
      accent: "red",
    },
  ];

  if (isAdmin) {
    cards.unshift({
      title: tr("Online Conversion", "معدل التحويل أونلاين"),
      value: `${Number(kpis.onlineConversionRate || 0).toFixed(2)}%`,
      hint: tr("Confirmed + shipped + delivered", "مؤكد + مشحون + تم التسليم"),
      icon: Globe,
      accent: "blue",
    });
    cards.unshift({
      title: tr("Pending Online Orders", "طلبات أونلاين معلقة"),
      value: number.format(kpis.pendingOnlineOrders || 0),
      hint: tr("Waiting for approval", "بانتظار الموافقة"),
      icon: ShoppingCart,
      accent: "purple",
    });
    cards.unshift({
      title: tr("Online Revenue", "إيراد المتجر"),
      value: money.format(Number(kpis.onlineRevenue || 0)),
      hint: tr("Storefront generated revenue", "إيراد قادم من المتجر"),
      icon: BadgeDollarSign,
      accent: "green",
    });
    cards.unshift({
      title: tr("Net Profit", "صافي الربح"),
      value: money.format(Number(kpis.netProfit || 0)),
      hint: tr("Company-wide profitability", "ربحية الشركة"),
      icon: BadgeDollarSign,
      accent: "green",
    });
    cards.unshift({
      title: tr("Revenue", "الإيرادات"),
      value: money.format(Number(kpis.totalRevenue || 0)),
      hint: tr("Gross sales value", "إجمالي قيمة المبيعات"),
      icon: BadgeDollarSign,
      accent: "orange",
    });
  } else {
    cards.unshift({
      title: tr("My Earnings", "أرباحي وعمولاتي"),
      value: money.format(Number(kpis.netProfit || 0)),
      hint: tr("Personal sales commissions", "أرباحك المحققة من العمولات"),
      icon: BadgeDollarSign,
      accent: "green",
    });
  }

  return (
    <div className="section-stack">
      <section className="kpi-grid">
        {cards.map((card) => (
          <KpiCard key={card.title} {...card} />
        ))}
      </section>

      <section className="charts-grid two">
        <article className="panel chart-panel">
          <h4>{isAdmin ? tr("Monthly Profit Trend", "اتجاه الربح الشهري") : tr("Monthly Sales Volume", "حجم المبيعات الشهري")}</h4>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={charts.monthlyProfit || []}>
              <defs>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff7a18" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#ff7a18" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="#ff7a18" fill="url(#colorProfit)" />
            </AreaChart>
          </ResponsiveContainer>
        </article>

        <article className="panel chart-panel">
          <h4>{tr("Employee Performance", "أداء الموظفين")}</h4>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={charts.employeePerformance || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="employeeName" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="salesCount" fill="#0f9d8f" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>
      </section>

      <section className="charts-grid two">
        <article className="panel">
          <div className="panel-head">
            <h3>{tr("Best Selling Laptops", "أكثر اللابات مبيعًا")}</h3>
            <span>
              {tr(
                "Open any laptop directly inside the products tab.",
                "افتح أي لاب مباشرة داخل تبويب المنتجات.",
              )}
            </span>
          </div>

          <div className="top-products-list">
            {bestSellingProducts.length === 0 ? (
              <p className="empty-note">{tr("No sales data yet.", "لا توجد بيانات مبيعات بعد.")}</p>
            ) : (
              bestSellingProducts.map((item) => (
                <button
                  key={`${item.laptopName}-${item.brand}`}
                  type="button"
                  className="top-product-btn"
                  onClick={() => onOpenProduct?.(item)}
                >
                  <div className="top-product-meta">
                    <strong>{item.laptopName}</strong>
                    <span>{item.brand || tr("Unknown Brand", "ماركة غير محددة")}</span>
                  </div>
                  <div className="top-product-stats">
                    <span>{tr("Sold", "تم بيع")} {number.format(item.quantity || 0)}</span>
                    <span>{money.format(Number(item.revenue || 0))}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-head">
            <h3>{tr("Low Stock Watch", "مراقبة المخزون المنخفض")}</h3>
            <span>{tr("Fast view for products that need restocking.", "عرض سريع للمنتجات التي تحتاج إعادة تخزين.")}</span>
          </div>

          <div className="stock-watch-list">
            {lowStockProducts.length === 0 ? (
              <p className="empty-note">{tr("No low stock alerts.", "لا توجد تنبيهات مخزون حاليًا.")}</p>
            ) : (
              lowStockProducts.map((item) => (
                <button
                  key={item.id || `${item.laptopName}-${item.brand}`}
                  type="button"
                  className="top-product-btn stock-watch-btn"
                  onClick={() => onOpenProduct?.(item)}
                >
                  <div className="top-product-meta">
                    <strong>{item.laptopName}</strong>
                    <span>{item.brand || tr("Unknown Brand", "ماركة غير محددة")}</span>
                  </div>
                  <div className="top-product-stats">
                    <span>{tr("Stock", "المخزون")}</span>
                    <span>{number.format(item.stock || 0)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </article>
      </section>

      {isAdmin && (
        <section className="panel table-panel">
          <div className="panel-head row-head">
            <div>
              <h3>{tr("Live Shipment & Delivery Tracking", "متابعة وتتبع الشحنات الحية")}</h3>
              <span>{tr("Sync real-time Bosta shipping delivery statuses directly.", "مزامنة حالات توصيل شحنات Bosta مباشرة في الوقت الفعلي.")}</span>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{tr("Order Number", "رقم الطلب")}</th>
                  <th>{tr("Customer", "العميل")}</th>
                  <th>{tr("Carrier", "شركة الشحن")}</th>
                  <th>{tr("Tracking Number", "رقم التتبع")}</th>
                  <th>{tr("Shipping Status", "حالة الشحن")}</th>
                  <th>{tr("Sync", "مزامنة")}</th>
                </tr>
              </thead>
              <tbody>
                {!overview.shipments || overview.shipments.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}>
                      {tr("No shipped orders tracking yet.", "لا توجد شحنات مسجلة للتتبع حالياً.")}
                    </td>
                  </tr>
                ) : (
                  overview.shipments.map((shipment) => (
                    <tr key={shipment.id}>
                      <td><strong>{shipment.orderNumber}</strong></td>
                      <td>{shipment.customerName || "-"}</td>
                      <td>
                        <div className="inline-actions" style={{ gap: "4px" }}>
                          <Truck size={14} />
                          {shipment.carrier}
                        </div>
                      </td>
                      <td>
                        {shipment.trackingNumber ? (
                          <a
                            href={`https://bosta.co/tracking-shipment/?track_num=${shipment.trackingNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-actions"
                            style={{ textDecoration: "underline", color: "var(--color-primary, #ff7a18)" }}
                          >
                            {shipment.trackingNumber}
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        <span className={`status-pill status-${shipment.shippingStatus === "delivered" ? "confirmed" : shipment.shippingStatus === "cancelled" ? "cancelled" : "pending"}`}>
                          {shipment.shippingStatus}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="secondary-btn"
                          style={{ padding: "4px 8px", fontSize: "12px", minHeight: "auto" }}
                          onClick={() => handleSyncStatus(shipment.id)}
                          disabled={syncingId === shipment.id || !shipment.trackingNumber}
                        >
                          <RefreshCw size={12} className={syncingId === shipment.id ? "spin" : ""} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isAdmin && (
        <section className="charts-grid two">
          <article className="panel">
            <div className="panel-head">
              <div className="inline-actions" style={{ gap: "8px" }}>
                <span className="agent-icon-badge" style={{ backgroundColor: "#8b5cf6" }}>
                  <Bot size={16} style={{ color: "#fff" }} />
                </span>
                <h3>{tr("AI Operations Log", "سجل عمليات الذكاء الاصطناعي")}</h3>
              </div>
              <span>{tr("Real-time telemetry and automation events from the AI Agent.", "أحداث الأتمتة المباشرة من نظام الذكاء الاصطناعي.")}</span>
            </div>

            <div className="console-log-wrap" style={{
              backgroundColor: "#0d0e12",
              color: "#38bdf8",
              fontFamily: "monospace",
              fontSize: "12.5px",
              padding: "16px",
              borderRadius: "8px",
              maxHeight: "350px",
              overflowY: "auto",
              border: "1px solid #1e293b",
              boxShadow: "inset 0 2px 4px rgba(0,0,0,0.6)"
            }}>
              {!overview.aiLogs || overview.aiLogs.length === 0 ? (
                <p style={{ color: "#64748b", margin: 0 }}>{tr("// No AI operations logged in this session.", "// لم يتم تسجيل أي عمليات حالياً.")}</p>
              ) : (
                overview.aiLogs.map((log) => (
                  <div key={log.id} style={{ marginBottom: "8px", borderBottom: "1px dashed #1e293b", paddingBottom: "4px" }}>
                    <span style={{ color: "#64748b" }}>[{new Date(log.timestamp).toLocaleTimeString()}]</span>{" "}
                    <span style={{ color: "#a78bfa", fontWeight: "bold" }}>[agent:{log.action}]</span>{" "}
                    <span style={{ color: "#e2e8f0" }}>{log.details}</span>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <h3>{tr("Activity Timeline", "الجدول الزمني للنشاط")}</h3>
              <span>{tr("Chronological log of recent platform transactions and support events.", "سجل الأحداث الأخيرة للمبيعات والطلبات والدعم.")}</span>
            </div>

            <div className="timeline-wrap" style={{ maxHeight: "350px", overflowY: "auto", paddingRight: "8px" }}>
              {!overview.timeline || overview.timeline.length === 0 ? (
                <p className="empty-note">{tr("No recent activity.", "لا توجد نشاطات حديثة.")}</p>
              ) : (
                <div className="timeline-container" style={{
                  position: "relative",
                  paddingLeft: isArabic ? "0" : "20px",
                  paddingRight: isArabic ? "20px" : "0",
                  borderLeft: isArabic ? "none" : "2px solid #e2e8f0",
                  borderRight: isArabic ? "2px solid #e2e8f0" : "none"
                }}>
                  {overview.timeline.map((event) => {
                    let icon = <Info size={12} />;
                    let iconBg = "#cbd5e1";
                    
                    if (event.type === "order_created") {
                      icon = <ShoppingCart size={12} style={{ color: "#fff" }} />;
                      iconBg = "#3b82f6";
                    } else if (event.type === "order_status") {
                      icon = <FileCheck size={12} style={{ color: "#fff" }} />;
                      iconBg = "#10b981";
                    } else if (event.type === "support_created" || event.type === "support_reply") {
                      icon = <MessageSquare size={12} style={{ color: "#fff" }} />;
                      iconBg = "#f59e0b";
                    } else if (event.type === "sale_created") {
                      icon = <BadgeDollarSign size={12} style={{ color: "#fff" }} />;
                      iconBg = "#8b5cf6";
                    }

                    return (
                      <div key={event.id} style={{ position: "relative", marginBottom: "16px" }}>
                        <div style={{
                          position: "absolute",
                          left: isArabic ? "unset" : "-29px",
                          right: isArabic ? "-29px" : "unset",
                          top: "2px",
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          backgroundColor: iconBg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 0 0 4px #fff"
                        }}>
                          {icon}
                        </div>
                        <div style={{ paddingLeft: isArabic ? "0" : "10px", paddingRight: isArabic ? "10px" : "0" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <strong style={{ fontSize: "14px" }}>{isArabic ? event.titleAr || event.title : event.title}</strong>
                            <span style={{ fontSize: "11px", color: "#64748b" }}>{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p style={{ margin: "4px 0 0 0", fontSize: "12.5px", color: "#475569" }}>
                            {isArabic ? event.descriptionAr || event.description : event.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </article>
        </section>
      )}
    </div>
  );
}
