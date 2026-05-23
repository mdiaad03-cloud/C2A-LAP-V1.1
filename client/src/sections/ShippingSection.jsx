import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Plus, RefreshCw, Truck } from "lucide-react";

const blank = {
  name: "",
  phone: "",
  notes: "",
};

export default function ShippingSection({
  role,
  shippingCompanies,
  onCreateShipping,
  onRefreshBostaHealth,
  onSyncBostaStatus,
  lang = "en",
}) {
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [bostaHealth, setBostaHealth] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [syncingOrderId, setSyncingOrderId] = useState(null);
  const isArabic = lang === "ar";
  const tr = (en, ar) => (isArabic ? ar : en);

  async function handleSyncStatus(orderId) {
    if (syncingOrderId || typeof onSyncBostaStatus !== "function") {
      return;
    }
    setSyncingOrderId(orderId);
    try {
      await onSyncBostaStatus(orderId);
      toast.success(tr("Bosta status synced successfully.", "تم مزامنة حالة الشحنة مع بوسطة بنجاح."));
      if (typeof onRefreshBostaHealth === "function") {
        const health = await onRefreshBostaHealth();
        setBostaHealth(health);
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Sync failed.", "فشلت مزامنة حالة الشحنة."));
    } finally {
      setSyncingOrderId(null);
    }
  }

  useEffect(() => {
    if (role !== "admin" || typeof onRefreshBostaHealth !== "function") {
      return;
    }

    let cancelled = false;

    async function loadHealth() {
      setLoadingHealth(true);
      try {
        const health = await onRefreshBostaHealth();
        if (!cancelled) {
          setBostaHealth(health);
        }
      } catch (error) {
        if (!cancelled) {
          setBostaHealth(null);
          toast.error(error?.response?.data?.error || tr("Could not load Bosta status.", "تعذر تحميل حالة Bosta."));
        }
      } finally {
        if (!cancelled) {
          setLoadingHealth(false);
        }
      }
    }

    void loadHealth();
    return () => {
      cancelled = true;
    };
  }, [onRefreshBostaHealth, role, isArabic]);

  function update(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) {
      return;
    }

    setSaving(true);
    try {
      await onCreateShipping(form);
      toast.success(tr("Shipping company added.", "تمت إضافة شركة الشحن."));
      setForm(blank);
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Could not add shipping company.", "تعذر إضافة شركة الشحن."));
    } finally {
      setSaving(false);
    }
  }

  async function refreshBostaHealth() {
    if (loadingHealth || typeof onRefreshBostaHealth !== "function") {
      return;
    }

    setLoadingHealth(true);
    try {
      const health = await onRefreshBostaHealth();
      setBostaHealth(health);
      toast.success(tr("Bosta status refreshed.", "تم تحديث حالة Bosta."));
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Could not load Bosta status.", "تعذر تحميل حالة Bosta."));
    } finally {
      setLoadingHealth(false);
    }
  }

  return (
    <div className="section-stack">
      {role === "admin" ? (
        <>
          <section className="panel form-panel">
            <div className="panel-head">
              <h3>{tr("Shipping Management", "إدارة الشحن")}</h3>
              <span>{tr("Manage shipping companies and representatives.", "إدارة شركات الشحن والمندوبين.")}</span>
            </div>

            <form className="form-grid" onSubmit={submit}>
              <label>
                {tr("Company Name", "اسم الشركة")}
                <input value={form.name} onChange={(event) => update("name", event.target.value)} required />
              </label>
              <label>
                {tr("Phone", "الهاتف")}
                <input value={form.phone} onChange={(event) => update("phone", event.target.value)} />
              </label>
              <label className="span-2">
                {tr("Notes", "ملاحظات")}
                <textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} />
              </label>
              <button className="primary-btn span-2" type="submit" disabled={saving}>
                <Plus size={16} />
                {saving ? tr("Saving...", "جارٍ الحفظ...") : tr("Add Shipping Company", "إضافة شركة شحن")}
              </button>
            </form>
          </section>

          <section className="panel table-panel">
            <div className="panel-head row-head">
              <div>
                <h3>{tr("Bosta Provider", "مزود Bosta")}</h3>
                <span>{tr("Check if the provider is configured and ready for shipment creation.", "تحقق من أن المزود مضبوط وجاهز لإنشاء الشحنات.")}</span>
              </div>
              <button type="button" className="secondary-btn" onClick={refreshBostaHealth} disabled={loadingHealth}>
                <RefreshCw size={14} />
                {loadingHealth ? tr("Refreshing...", "جارٍ التحديث...") : tr("Refresh", "تحديث")}
              </button>
            </div>

            <div className="agent-settings-summary">
              <span className={`status-pill ${bostaHealth?.configured ? "status-confirmed" : "status-cancelled"}`}>
                {tr("Configured", "مضبوط")} · {bostaHealth?.configured ? tr("Yes", "نعم") : tr("No", "لا")}
              </span>
              <span className={`status-pill ${bostaHealth?.reachable ? "status-confirmed" : "status-pending"}`}>
                {tr("Reachable", "متاح")} · {bostaHealth?.reachable ? tr("Yes", "نعم") : tr("Unknown", "غير معروف")}
              </span>
              <span className="status-pill status-pending">
                {tr("Pickup Locations", "نقاط الاستلام")} · {Number(bostaHealth?.pickupLocationsCount || 0)}
              </span>
            </div>

            {bostaHealth?.stats ? (
              <div className="bosta-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", padding: "0 18px", marginTop: "15px", marginBottom: "15px" }}>
                <div className="stat-card" style={{ background: "var(--panel-active, #f8fafc)", padding: "10px", borderRadius: "12px", border: "1px solid var(--line)", textAlign: "center" }}>
                  <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>{bostaHealth.stats.total}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{tr("Total Shipped", "إجمالي الشحنات")}</div>
                </div>
                <div className="stat-card" style={{ background: "var(--panel-active, #f8fafc)", padding: "10px", borderRadius: "12px", border: "1px solid var(--line)", textAlign: "center" }}>
                  <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#f59e0b" }}>{bostaHealth.stats.pendingPickup}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{tr("Pending Pickup", "قيد انتظار الاستلام")}</div>
                </div>
                <div className="stat-card" style={{ background: "var(--panel-active, #f8fafc)", padding: "10px", borderRadius: "12px", border: "1px solid var(--line)", textAlign: "center" }}>
                  <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#3b82f6" }}>{bostaHealth.stats.inTransit}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{tr("In Transit", "جارٍ الشحن")}</div>
                </div>
                <div className="stat-card" style={{ background: "var(--panel-active, #f8fafc)", padding: "10px", borderRadius: "12px", border: "1px solid var(--line)", textAlign: "center" }}>
                  <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#10b981" }}>{bostaHealth.stats.delivered}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{tr("Delivered", "تم التسليم")}</div>
                </div>
                <div className="stat-card" style={{ background: "var(--panel-active, #f8fafc)", padding: "10px", borderRadius: "12px", border: "1px solid var(--line)", textAlign: "center" }}>
                  <div style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#ef4444" }}>{bostaHealth.stats.cancelled}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{tr("Returned / Cancelled", "مرتجع / ملغي")}</div>
                </div>
              </div>
            ) : null}

            <div className="agent-suggestion-box">
              <div className="agent-suggestion-head">
                <strong>{tr("Current Summary", "الملخص الحالي")}</strong>
              </div>
              <p>
                {bostaHealth?.configured
                  ? tr(
                      "Bosta credentials are configured. You can now create shipments directly from online orders.",
                      "تم ضبط بيانات Bosta. يمكنك الآن إنشاء الشحنات مباشرة من الطلبات الإلكترونية.",
                    )
                  : tr(
                      "Bosta is not configured yet. Add the API key and required settings in the server environment before going live.",
                      "لم يتم ضبط Bosta بعد. أضف مفتاح الـ API والإعدادات المطلوبة في بيئة السيرفر قبل النشر.",
                    )}
              </p>
            </div>
          </section>

          {bostaHealth?.orders && bostaHealth.orders.length > 0 ? (
            <section className="panel table-panel">
              <div className="panel-head">
                <h3>{tr("Bosta Shipments Tracker", "تتبع شحنات بوسطة")}</h3>
                <span>{tr("List of orders shipped via Bosta and their live tracking status.", "قائمة بالطلبات المشحونة عبر بوسطة وحالة تتبعها المباشرة.")}</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{tr("Order No", "رقم الطلب")}</th>
                      <th>{tr("Customer / Phone", "العميل / الهاتف")}</th>
                      <th>{tr("COD Amount", "مبلغ التحصيل")}</th>
                      <th>{tr("Tracking Number", "رقم التتبع")}</th>
                      <th>{tr("Shipping Status", "حالة الشحن")}</th>
                      <th>{tr("Actions", "إجراءات")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bostaHealth.orders.map((shipment) => (
                      <tr key={shipment.id}>
                        <td><strong>{shipment.orderNumber}</strong></td>
                        <td>
                          <div>{shipment.customerName}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{shipment.customerPhone}</div>
                        </td>
                        <td>{shipment.total} EGP</td>
                        <td>
                          {shipment.trackingNumber ? (
                            <a
                              href={`https://tracking.bosta.co/tracker/${shipment.trackingNumber}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ textDecoration: "underline", color: "var(--brand, #ff7a18)", fontWeight: "bold" }}
                            >
                              {shipment.trackingNumber}
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>
                          <span className={`status-pill status-${String(shipment.shippingStatus || "").toLowerCase().replace(/[^a-z0-9]/g, "_")}`}>
                            {shipment.shippingStatus || tr("Unknown", "غير معروف")}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="icon-btn"
                            title={tr("Sync Status", "مزامنة الحالة")}
                            onClick={() => handleSyncStatus(shipment.id)}
                            disabled={syncingOrderId === shipment.id}
                            style={{ padding: "4px 8px" }}
                          >
                            <RefreshCw size={14} className={syncingOrderId === shipment.id ? "spin" : ""} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      <section className="panel table-panel">
        <div className="panel-head">
          <h3>{tr("Shipping Partners", "شركاء الشحن")}</h3>
          <span>{tr("Available shipping providers for sales and online orders.", "شركات الشحن المتاحة للمبيعات والطلبات الإلكترونية.")}</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{tr("Name", "الاسم")}</th>
                <th>{tr("Phone", "الهاتف")}</th>
                <th>{tr("Notes", "ملاحظات")}</th>
              </tr>
            </thead>
            <tbody>
              {shippingCompanies.length === 0 ? (
                <tr>
                  <td colSpan={3}>{tr("No shipping companies found.", "لا توجد شركات شحن.")}</td>
                </tr>
              ) : (
                shippingCompanies.map((company) => (
                  <tr key={company.id}>
                    <td>
                      <div className="inline-actions">
                        <span className="agent-icon-badge">
                          <Truck size={14} />
                        </span>
                        {company.name}
                      </div>
                    </td>
                    <td>{company.phone || "-"}</td>
                    <td>{company.notes || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
