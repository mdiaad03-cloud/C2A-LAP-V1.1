import { useState } from "react";
import toast from "react-hot-toast";
import { Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { formatDateTime } from "../utils/format";

const emptyCoupon = {
  code: "",
  type: "percent", // percent, fixed, free_shipping
  value: "",
  usageLimit: "",
};

export default function CouponsSection({
  coupons = [],
  onCreateCoupon,
  onUpdateCoupon,
  onDeleteCoupon,
  lang = "en",
}) {
  const [form, setForm] = useState(emptyCoupon);
  const [saving, setSaving] = useState(false);
  const isArabic = lang === "ar";
  const tr = (en, ar) => (isArabic ? ar : en);

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
      await onCreateCoupon({
        code: form.code.trim().toUpperCase(),
        type: form.type,
        value: form.type === "free_shipping" ? 0 : Number(form.value) || 0,
        usageLimit: Number(form.usageLimit) || 0,
      });
      toast.success(tr("Coupon created successfully.", "تم إنشاء الكوبون بنجاح."));
      setForm(emptyCoupon);
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Failed to create coupon.", "تعذر إنشاء الكوبون."));
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(coupon) {
    try {
      await onUpdateCoupon(coupon.id, { isActive: !coupon.isActive });
      toast.success(tr("Coupon status updated.", "تم تحديث حالة الكوبون."));
    } catch (error) {
      toast.error(tr("Failed to update status.", "تعذر تحديث حالة الكوبون."));
    }
  }

  async function deleteCoupon(coupon) {
    if (!window.confirm(tr(`Are you sure you want to delete ${coupon.code}?`, `هل أنت متأكد من حذف الكوبون ${coupon.code}؟`))) {
      return;
    }
    try {
      await onDeleteCoupon(coupon.id);
      toast.success(tr("Coupon deleted.", "تم حذف الكوبون."));
    } catch (error) {
      toast.error(tr("Failed to delete coupon.", "تعذر حذف الكوبون."));
    }
  }

  return (
    <div className="section-stack">
      <section className="panel form-panel">
        <div className="panel-head">
          <h3>{tr("Create Discount Coupon", "إنشاء كوبون خصم")}</h3>
          <span>{tr("Define new discount codes with usage limits for your customers.", "قم بإنشاء أكواد خصم جديدة مع تحديد عدد مرات الاستخدام للعملاء.")}</span>
        </div>

        <form className="form-grid" onSubmit={submit}>
          <label>
            {tr("Coupon Code", "كود الكوبون")}
            <input
              placeholder="e.g. WELCOME10"
              value={form.code}
              onChange={(event) => update("code", event.target.value)}
              required
            />
          </label>
          <label>
            {tr("Discount Type", "نوع الخصم")}
            <select value={form.type} onChange={(event) => update("type", event.target.value)}>
              <option value="percent">{tr("Percentage (%)", "نسبة مئوية (%)")}</option>
              <option value="fixed">{tr("Fixed Amount (EGP)", "مبلغ ثابت (ج.م)")}</option>
              <option value="free_shipping">{tr("Free Shipping", "شحن مجاني")}</option>
            </select>
          </label>
          {form.type !== "free_shipping" && (
            <label>
              {tr("Value", "القيمة")}
              <input
                type="number"
                min="1"
                placeholder={form.type === "percent" ? "e.g. 10" : "e.g. 100"}
                value={form.value}
                onChange={(event) => update("value", event.target.value)}
                required
              />
            </label>
          )}
          <label>
            {tr("Usage Limit (Max People)", "الحد الأقصى للمستخدمين")}
            <input
              type="number"
              min="0"
              placeholder={tr("0 for unlimited", "0 لعدد غير محدود")}
              value={form.usageLimit}
              onChange={(event) => update("usageLimit", event.target.value)}
              required
            />
          </label>
          <button type="submit" className="primary-btn span-2" disabled={saving}>
            <Plus size={16} />
            {saving ? tr("Creating...", "جارٍ الإنشاء...") : tr("Create Coupon", "إنشاء كوبون")}
          </button>
        </form>
      </section>

      <section className="panel table-panel">
        <div className="panel-head row-head">
          <div>
            <h3>{tr("Coupons List", "قائمة الكوبونات")}</h3>
            <span>{tr("Review and manage active coupons and track their usage counts.", "راجع وأدر الكوبونات النشطة وتابع عدد مرات استخدامها.")}</span>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{tr("Code", "الكود")}</th>
                <th>{tr("Type", "النوع")}</th>
                <th>{tr("Value", "القيمة")}</th>
                <th>{tr("Usage Limit", "الحد الأقصى")}</th>
                <th>{tr("Usage Count", "المستخدمون حالياً")}</th>
                <th>{tr("Status", "الحالة")}</th>
                <th>{tr("Actions", "إجراءات")}</th>
              </tr>
            </thead>
            <tbody>
              {coupons.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--muted)" }}>
                    {tr("No coupons found.", "لا توجد كوبونات.")}
                  </td>
                </tr>
              ) : (
                coupons.map((coupon) => (
                  <tr key={coupon.id}>
                    <td><strong>{coupon.code}</strong></td>
                    <td style={{ textTransform: "capitalize" }}>
                      {coupon.type === "percent" ? tr("Percentage", "نسبة مئوية") : coupon.type === "fixed" ? tr("Fixed Amount", "مبلغ ثابت") : tr("Free Shipping", "شحن مجاني")}
                    </td>
                    <td>{coupon.type === "free_shipping" ? "-" : coupon.type === "percent" ? `${coupon.value}%` : `${coupon.value} EGP`}</td>
                    <td>{coupon.usageLimit === 0 ? tr("Unlimited", "غير محدود") : coupon.usageLimit}</td>
                    <td><strong>{coupon.usageCount || 0}</strong></td>
                    <td>
                      <button
                        type="button"
                        onClick={() => toggleStatus(coupon)}
                        style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                        title={coupon.isActive ? tr("Deactivate", "تعطيل") : tr("Activate", "تفعيل")}
                      >
                        {coupon.isActive ? (
                          <>
                            <ToggleRight size={22} color="#10b981" />
                            <span style={{ color: "#10b981", fontSize: "0.8rem" }}>{tr("Active", "نشط")}</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft size={22} color="#9ca3af" />
                            <span style={{ color: "#9ca3af", fontSize: "0.8rem" }}>{tr("Inactive", "معطل")}</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="secondary-btn danger-outline"
                        onClick={() => deleteCoupon(coupon)}
                        style={{ padding: "0.3rem 0.6rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      >
                        <Trash2 size={12} />
                        {tr("Delete", "حذف")}
                      </button>
                    </td>
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
