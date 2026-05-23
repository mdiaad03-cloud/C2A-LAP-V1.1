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
  lang = "en",
}) {
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [bostaHealth, setBostaHealth] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const isArabic = lang === "ar";
  const tr = (en, ar) => (isArabic ? ar : en);

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
