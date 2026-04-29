import { useState } from "react";
import toast from "react-hot-toast";
import { Plus } from "lucide-react";

const blank = {
  name: "",
  phone: "",
  notes: "",
};

export default function ShippingSection({ role, shippingCompanies, onCreateShipping, lang = "en" }) {
  const [form, setForm] = useState(blank);
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
      await onCreateShipping(form);
      toast.success(tr("Shipping company added.", "تمت إضافة شركة الشحن."));
      setForm(blank);
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Could not add shipping company.", "تعذر إضافة شركة الشحن."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="section-stack">
      {role === "admin" ? (
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
      ) : null}

      <section className="panel table-panel">
        <div className="panel-head">
          <h3>{tr("Shipping Partners", "شركاء الشحن")}</h3>
          <span>{tr("Available shipping providers for sale records.", "شركات الشحن المتاحة لسجلات البيع.")}</span>
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
                    <td>{company.name}</td>
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
