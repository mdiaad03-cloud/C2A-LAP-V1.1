import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Filter, PackageSearch, RefreshCw } from "lucide-react";
import { formatDateTime, money, number } from "../utils/format";

const statusOptions = [
  { key: "" },
  { key: "pending" },
  { key: "confirmed" },
  { key: "shipped" },
  { key: "delivered" },
  { key: "cancelled" },
];

function initialDraft(order) {
  return {
    status: order.status || "pending",
    assignedEmployeeId: order.assignedEmployeeId || "",
    shippingCompanyName: order.shippingCompanyName || "",
    shippingCompanyPhone: order.shippingCompanyPhone || "",
    trackingNumber: order.trackingNumber || "",
    shippingStatus: order.shippingStatus || "",
    paymentStatus: order.paymentStatus || "pending_collection",
  };
}

export default function OnlineOrdersSection({
  orders = [],
  analytics,
  users = [],
  filters,
  onFiltersChange,
  onUpdateOrder,
  lang = "en",
}) {
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState("");
  const isArabic = lang === "ar";
  const tr = (en, ar) => (isArabic ? ar : en);
  const statusLabel = (statusKey) => {
    if (!statusKey) {
      return tr("All", "الكل");
    }
    return ({
      pending: tr("Pending", "معلق"),
      confirmed: tr("Confirmed", "مؤكد"),
      shipped: tr("Shipped", "تم الشحن"),
      delivered: tr("Delivered", "تم التسليم"),
      cancelled: tr("Cancelled", "ملغي"),
    })[statusKey] || statusKey;
  };

  const salesUsers = useMemo(
    () => users.filter((user) => user.role === "sales"),
    [users],
  );

  function getDraft(order) {
    return drafts[order.id] || initialDraft(order);
  }

  function updateDraft(orderId, patch) {
    setDrafts((prev) => ({
      ...prev,
      [orderId]: {
        ...(prev[orderId] || {}),
        ...patch,
      },
    }));
  }

  async function submitOrderUpdate(order) {
    if (savingId) {
      return;
    }

    const draft = getDraft(order);
    setSavingId(order.id);
    try {
      await onUpdateOrder(order.id, draft);
      toast.success(
        isArabic ? `تم تحديث الطلب ${order.orderNumber}.` : `Order ${order.orderNumber} updated.`,
      );
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[order.id];
        return next;
      });
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Failed to update order.", "فشل تحديث الطلب."));
    } finally {
      setSavingId("");
    }
  }

  const statusCounts = analytics?.byStatus || {};

  return (
    <div className="section-stack">
      <section className="profit-cards">
        <article>
          <p>{tr("Total Orders", "إجمالي الطلبات")}</p>
          <h4>{number.format(analytics?.totalOrders || 0)}</h4>
        </article>
        <article>
          <p>{tr("Conversion Rate", "معدل التحويل")}</p>
          <h4>{Number(analytics?.conversionRate || 0).toFixed(2)}%</h4>
        </article>
        <article>
          <p>{tr("Online Revenue", "إيراد أونلاين")}</p>
          <h4>{money.format(Number(analytics?.onlineRevenue || 0))}</h4>
        </article>
        <article>
          <p>{tr("Average Order Value", "متوسط قيمة الطلب")}</p>
          <h4>{money.format(Number(analytics?.averageOrderValue || 0))}</h4>
        </article>
        <article>
          <p>{tr("Revenue (Online / Manual)", "الإيراد (أونلاين / يدوي)")}</p>
          <h4>
            {money.format(Number(analytics?.revenueComparison?.online || 0))}
            {" / "}
            {money.format(Number(analytics?.revenueComparison?.manual || 0))}
          </h4>
        </article>
      </section>

      <section className="panel table-panel">
        <div className="panel-head row-head">
          <div>
            <h3>{tr("Online Orders", "طلبات المتجر")}</h3>
            <span>{tr("Review, approve, assign, and track every customer checkout from the website.", "راجع ووافق وعيّن وتابع كل طلب عميل من الموقع.")}</span>
          </div>
          <div className="filters-inline">
            <Filter size={14} />
            <input
              placeholder={tr("Search order/customer/tracking", "ابحث بالطلب/العميل/التتبع")}
              value={filters.query || ""}
              onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
            />
          </div>
        </div>

        <div className="filters-grid">
          <label>
            {tr("Date From", "من تاريخ")}
            <input
              type="date"
              value={filters.dateFrom || ""}
              onChange={(event) => onFiltersChange({ ...filters, dateFrom: event.target.value })}
            />
          </label>
          <label>
            {tr("Date To", "إلى تاريخ")}
            <input
              type="date"
              value={filters.dateTo || ""}
              onChange={(event) => onFiltersChange({ ...filters, dateTo: event.target.value })}
            />
          </label>
          <label>
            {tr("Status", "الحالة")}
            <select
              value={filters.status || ""}
              onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })}
            >
              {statusOptions.map((status) => (
                <option key={status.key} value={status.key}>
                  {statusLabel(status.key)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {tr("City", "المدينة")}
            <input
              value={filters.city || ""}
              onChange={(event) => onFiltersChange({ ...filters, city: event.target.value })}
              placeholder="Cairo"
            />
          </label>
        </div>

        <div className="inline-actions">
          {statusOptions.slice(1).map((status) => (
            <button
              key={status.key}
              type="button"
              className={filters.status === status.key ? "primary-btn" : "secondary-btn"}
              onClick={() => onFiltersChange({ ...filters, status: status.key })}
            >
              {statusLabel(status.key)} ({number.format(statusCounts[status.key] || 0)})
            </button>
          ))}
          <button
            type="button"
            className="secondary-btn"
            onClick={() =>
              onFiltersChange({
                status: "",
                query: "",
                city: "",
                dateFrom: "",
                dateTo: "",
              })
            }
          >
            <RefreshCw size={14} />
            {tr("Reset", "إعادة ضبط")}
          </button>
        </div>

        <div className="online-orders-grid">
          {orders.length === 0 ? (
            <article className="online-order-card empty">
              <PackageSearch size={22} />
              <p>{tr("No online orders match current filters.", "لا توجد طلبات مطابقة للفلاتر الحالية.")}</p>
            </article>
          ) : (
            orders.map((order) => {
              const draft = getDraft(order);
              return (
                <article key={order.id} className="online-order-card">
                  <div className="online-order-head">
                    <div>
                      <h4>{order.orderNumber}</h4>
                      <p>{formatDateTime(order.createdAt)}</p>
                    </div>
                    <span className={`status-pill status-${order.status}`}>{order.status}</span>
                  </div>

                  <div className="online-order-meta">
                    <p>
                      <strong>{tr("Customer", "العميل")}:</strong> {order.customerName} ({order.customerPhone})
                    </p>
                    <p>
                      <strong>{tr("Address", "العنوان")}:</strong> {order.customerAddress}, {order.customerCity}
                    </p>
                    <p>
                      <strong>{tr("Items", "المنتجات")}:</strong> {number.format(order.items?.length || 0)} {tr("lines", "عنصر")} | {tr("Subtotal", "الإجمالي الفرعي")}{" "}
                      {money.format(Number(order.subtotal || 0))}
                    </p>
                    <p>
                      <strong>{tr("Total", "الإجمالي")}:</strong> {money.format(Number(order.total || 0))}
                    </p>
                    <p>
                      <strong>{tr("Payment", "الدفع")}:</strong> {(order.paymentMethod || "cash_on_delivery").replace(/_/g, " ")} -{" "}
                      {order.paymentStatus || "pending_collection"}
                    </p>
                  </div>

                  <div className="form-grid online-order-form">
                    <label>
                      {tr("Status", "الحالة")}
                      <select
                        value={draft.status}
                        onChange={(event) => updateDraft(order.id, { status: event.target.value })}
                      >
                        {statusOptions.slice(1).map((status) => (
                          <option key={status.key} value={status.key}>
                            {statusLabel(status.key)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {tr("Assign Employee", "تعيين موظف")}
                      <select
                        value={draft.assignedEmployeeId}
                        onChange={(event) =>
                          updateDraft(order.id, { assignedEmployeeId: event.target.value })
                        }
                      >
                        <option value="">{tr("Online Store (Auto)", "المتجر الأونلاين (تلقائي)")}</option>
                        {salesUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {tr("Shipping Company", "شركة الشحن")}
                      <input
                        value={draft.shippingCompanyName}
                        onChange={(event) =>
                          updateDraft(order.id, { shippingCompanyName: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      {tr("Shipping Phone", "هاتف الشحن")}
                      <input
                        value={draft.shippingCompanyPhone}
                        onChange={(event) =>
                          updateDraft(order.id, { shippingCompanyPhone: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      {tr("Tracking Number", "رقم التتبع")}
                      <input
                        value={draft.trackingNumber}
                        onChange={(event) =>
                          updateDraft(order.id, { trackingNumber: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      {tr("Payment Status", "حالة الدفع")}
                      <select
                        value={draft.paymentStatus}
                        onChange={(event) =>
                          updateDraft(order.id, { paymentStatus: event.target.value })
                        }
                      >
                        <option value="pending_collection">{tr("Pending Collection", "بانتظار التحصيل")}</option>
                        <option value="pending_verification">{tr("Pending Verification", "بانتظار التحقق")}</option>
                        <option value="paid">{tr("Paid", "مدفوع")}</option>
                        <option value="failed">{tr("Failed", "فشل")}</option>
                        <option value="refunded">{tr("Refunded", "تم الاسترجاع")}</option>
                      </select>
                    </label>
                    <label>
                      {tr("Shipping Status", "حالة الشحن")}
                      <input
                        value={draft.shippingStatus}
                        onChange={(event) =>
                          updateDraft(order.id, { shippingStatus: event.target.value })
                        }
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => submitOrderUpdate(order)}
                    disabled={savingId === order.id}
                  >
                    {savingId === order.id ? tr("Saving...", "جارٍ الحفظ...") : tr("Update Order", "تحديث الطلب")}
                  </button>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
