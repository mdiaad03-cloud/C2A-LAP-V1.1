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
} from "lucide-react";
import KpiCard from "../components/KpiCard";
import { money, number } from "../utils/format";

export default function DashboardSection({ overview, isAdmin, lang = "en", onOpenProduct }) {
  const kpis = overview?.kpis || {};
  const charts = overview?.charts || {};
  const isArabic = lang === "ar";
  const tr = (en, ar) => (isArabic ? ar : en);
  const bestSellingProducts = charts.bestSellingProducts || [];
  const lowStockProducts = charts.lowStockProducts || [];

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
    </div>
  );
}
