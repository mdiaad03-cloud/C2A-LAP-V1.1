import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Filter, PackageSearch, RefreshCw } from "lucide-react";
import { formatDateTime, money, number } from "../utils/format";
import api from "../lib/api";


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
  onCreateBostaShipment,
  lang = "en",
}) {
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState("");
  const [bostaLoadingId, setBostaLoadingId] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState(null);
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

  async function submitBostaShipment(order) {
    if (bostaLoadingId || typeof onCreateBostaShipment !== "function") {
      return;
    }

    setBostaLoadingId(order.id);
    try {
      await onCreateBostaShipment(order.id, { notes: order.notes || "" });
      toast.success(
        isArabic ? `تم إنشاء شحنة Bosta للطلب ${order.orderNumber}.` : `Bosta shipment created for ${order.orderNumber}.`,
      );
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Failed to create Bosta shipment.", "فشل إنشاء شحنة Bosta."));
    } finally {
      setBostaLoadingId("");
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

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{tr("Order No.", "رقم الطلب")}</th>
                <th>{tr("Date", "التاريخ")}</th>
                <th>{tr("Customer", "العميل")}</th>
                <th>{tr("City", "المدينة")}</th>
                <th>{tr("Total", "الإجمالي")}</th>
                <th>{tr("Payment", "الدفع")}</th>
                <th>{tr("Pay Status", "حالة الدفع")}</th>
                <th>{tr("Status", "الحالة")}</th>
                <th>{tr("Assignee", "المعين")}</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", color: "var(--muted)", padding: "2rem" }}>
                    <PackageSearch size={22} style={{ display: "block", margin: "0 auto 0.5rem" }} />
                    {tr("No online orders match current filters.", "لا توجد طلبات مطابقة للفلاتر الحالية.")}
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const isExpanded = expandedOrderId === order.id;
                  const draft = getDraft(order);
                  return (
                    <>
                      <tr
                        key={order.id}
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        className={`clickable-row ${isExpanded ? "row-active" : ""}`}
                        style={{ cursor: "pointer", transition: "background 0.2s" }}
                      >
                        <td><strong>{order.orderNumber}</strong></td>
                        <td>{formatDateTime(order.createdAt)}</td>
                        <td>{order.customerName} <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>({order.customerPhone})</span></td>
                        <td>{order.customerCity}</td>
                        <td><strong>{money.format(Number(order.total || 0))}</strong></td>
                        <td style={{ textTransform: "capitalize" }}>{(order.paymentMethod || "cash_on_delivery").replace(/_/g, " ")}</td>
                        <td>
                          <span className={`status-pill status-${order.paymentStatus || "pending"}`} style={{ display: "inline-block" }}>
                            {order.paymentStatus || "pending_collection"}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill status-${order.status}`} style={{ display: "inline-block" }}>
                            {order.status}
                          </span>
                        </td>
                        <td>{order.assignedEmployeeName || tr("Auto", "تلقائي")}</td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${order.id}-details`}>
                          <td colSpan={9} style={{ background: "color-mix(in srgb, var(--surface) 96%, transparent)", padding: "1.5rem", borderBottom: "2px solid var(--primary, #ff7a18)" }}>
                            <div style={{ display: "grid", gap: "1.2rem" }}>
                              {/* Summary / Shipping Info */}
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem", fontSize: "0.9rem" }}>
                                <div>
                                  <h5 style={{ margin: "0 0 0.5rem 0", color: "var(--primary, #ff7a18)" }}>{tr("Delivery & Notes", "بيانات التوصيل والملاحظات")}</h5>
                                  <p style={{ margin: "0.2rem 0" }}><strong>{tr("Address", "العنوان")}:</strong> {order.customerAddress}, {order.customerCity}, {order.customerCountry}</p>
                                  {order.customerNotes && (
                                    <p style={{ margin: "0.2rem 0", color: "var(--warning, #f59e0b)" }}>
                                      <strong>{tr("Customer Notes", "ملاحظات العميل")}:</strong> {order.customerNotes}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <h5 style={{ margin: "0 0 0.5rem 0", color: "var(--primary, #ff7a18)" }}>{tr("Order Items", "منتجات الطلب")}</h5>
                                  <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "var(--text)" }}>
                                    {(order.items || []).map((item, idx) => (
                                      <li key={idx} style={{ margin: "0.2rem 0" }}>
                                        {item.brand} {item.laptopName} <span style={{ color: "var(--muted)" }}>(Qty: {item.quantity})</span> - <strong>{money.format(item.discountedUnitPrice)}</strong>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>

                              {/* Form grid */}
                              <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px", borderTop: "1px dashed var(--line)", paddingTop: "1rem" }}>
                                <label>
                                  {tr("Order Status", "حالة الطلب")}
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

                              {/* Screenshots Section */}
                              <div style={{
                                borderTop: "1px dashed var(--line)",
                                paddingTop: "1.2rem",
                                marginTop: "0.5rem"
                              }}>
                                <h5 style={{ margin: "0 0 0.8rem 0", color: "var(--primary, #ff7a18)", display: "flex", alignItems: "center", gap: "8px" }}>
                                  <span style={{ fontSize: "1.1rem" }}>📷</span>
                                  {tr("Payment & Confirmation Screenshots", "لقطات شاشة الدفع والتأكيد")}
                                </h5>
                                
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "1rem" }}>
                                  {(order.screenshotUrls || []).length === 0 ? (
                                    <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem", fontStyle: "italic" }}>
                                      {tr("No screenshots uploaded yet.", "لم يتم رفع أي لقطات شاشة بعد.")}
                                    </p>
                                  ) : (
                                    (order.screenshotUrls || []).map((url, idx) => (
                                      <div key={idx} style={{
                                        position: "relative",
                                        width: "100px",
                                        height: "100px",
                                        borderRadius: "12px",
                                        border: "1px solid var(--line)",
                                        overflow: "hidden",
                                        background: "var(--surface)",
                                        boxShadow: "var(--shadow)",
                                        transition: "transform 0.2s"
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
                                      onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                                      >
                                        <img src={url} alt={`Screenshot ${idx + 1}`} style={{
                                          width: "100%",
                                          height: "100%",
                                          objectFit: "cover",
                                          cursor: "pointer"
                                        }} onClick={() => window.open(url, "_blank")} />
                                        <button
                                          type="button"
                                          style={{
                                            position: "absolute",
                                            top: "6px",
                                            right: "6px",
                                            background: "rgba(214, 64, 69, 0.95)",
                                            color: "#fff",
                                            border: "0",
                                            borderRadius: "50%",
                                            width: "22px",
                                            height: "22px",
                                            display: "grid",
                                            placeItems: "center",
                                            cursor: "pointer",
                                            fontSize: "0.8rem",
                                            lineHeight: 1,
                                            boxShadow: "0 2px 5px rgba(0,0,0,0.2)"
                                          }}
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            if (window.confirm(tr("Are you sure you want to delete this screenshot?", "هل أنت متأكد من حذف لقطة الشاشة هذه؟"))) {
                                              const updatedUrls = (order.screenshotUrls || []).filter((_, i) => i !== idx);
                                              const toastId = toast.loading(tr("Deleting screenshot...", "جاري حذف لقطة الشاشة..."));
                                              try {
                                                await onUpdateOrder(order.id, { screenshotUrls: updatedUrls });
                                                toast.success(tr("Screenshot deleted successfully.", "تم حذف لقطة الشاشة بنجاح."), { id: toastId });
                                              } catch (err) {
                                                toast.error(tr("Failed to delete screenshot.", "فشل في حذف لقطة الشاشة."), { id: toastId });
                                              }
                                            }
                                          }}
                                          title={tr("Delete", "حذف")}
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ))
                                  )}
                                </div>

                                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                                  <label className="secondary-btn" style={{ cursor: "pointer", position: "relative", padding: "8px 12px", fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                    <span>📁 {tr("Upload Screenshots (Max 3 files)", "رفع لقطات الشاشة (بحد أقصى 3 ملفات)")}</span>
                                    <input
                                      type="file"
                                      multiple
                                      accept="image/*"
                                      style={{
                                        position: "absolute",
                                        top: 0,
                                        left: 0,
                                        opacity: 0,
                                        width: "100%",
                                        height: "100%",
                                        cursor: "pointer"
                                      }}
                                      onChange={async (event) => {
                                        const files = event.target.files;
                                        if (!files || files.length === 0) return;
                                        
                                        if (files.length > 3) {
                                          toast.error(tr("You can upload a maximum of 3 images at once.", "يمكنك رفع 3 صور بحد أقصى في المرة الواحدة."));
                                          return;
                                        }

                                        const formData = new FormData();
                                        for (let i = 0; i < files.length; i++) {
                                          formData.append("screenshots", files[i]);
                                        }

                                        const toastId = toast.loading(tr("Uploading screenshots...", "جاري رفع لقطات الشاشة..."));
                                        try {
                                          await api.post(`/online-orders/${order.id}/screenshot`, formData, {
                                            headers: { "Content-Type": "multipart/form-data" }
                                          });
                                          // Force immediate UI refresh
                                          await onUpdateOrder(order.id, {});
                                          toast.success(tr("Screenshots uploaded successfully.", "تم رفع لقطات الشاشة بنجاح."), { id: toastId });
                                        } catch (err) {
                                          toast.error(err?.response?.data?.error || tr("Failed to upload screenshots.", "فشل في رفع لقطات الشاشة."), { id: toastId });
                                        }
                                      }}
                                    />
                                  </label>
                                  <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                                    {tr("Supports PNG, JPG, JPEG up to 5MB", "يدعم صيغ PNG, JPG, JPEG حتى 5 ميجابايت")}
                                  </span>
                                </div>
                              </div>

                              {/* Form actions */}
                              <div className="inline-actions stretch" style={{ marginTop: "0.5rem" }}>
                                <button
                                  type="button"
                                  className="primary-btn"
                                  onClick={() => submitOrderUpdate(order)}
                                  disabled={savingId === order.id}
                                >
                                  {savingId === order.id ? tr("Saving...", "جارٍ الحفظ...") : tr("Update Order", "تحديث الطلب")}
                                </button>
                                {typeof onCreateBostaShipment === "function" ? (
                                  <button
                                    type="button"
                                    className="secondary-btn"
                                    onClick={() => submitBostaShipment(order)}
                                    disabled={bostaLoadingId === order.id || !["confirmed", "shipped"].includes(order.status)}
                                  >
                                    {bostaLoadingId === order.id
                                      ? tr("Creating Bosta...", "جارٍ إنشاء Bosta...")
                                      : tr("Create Bosta Shipment", "إنشاء شحنة Bosta")}
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
