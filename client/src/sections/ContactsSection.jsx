import { useState } from "react";
import toast from "react-hot-toast";
import { Plus } from "lucide-react";
import { formatDateTime } from "../utils/format";

const emptyContact = {
  name: "",
  phone: "",
  address: "",
  notes: "",
};

export default function ContactsSection({ contacts, onCreateContact, onSearch, query, lang = "en" }) {
  const [form, setForm] = useState(emptyContact);
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
      await onCreateContact(form);
      toast.success(tr("Contact added.", "تمت إضافة العميل."));
      setForm(emptyContact);
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Could not add contact.", "تعذر إضافة العميل."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="section-stack">
      <section className="panel form-panel">
        <div className="panel-head">
          <h3>{tr("Client Contacts", "جهات اتصال العملاء")}</h3>
          <span>{tr("Manage customer info and quick follow-ups.", "إدارة بيانات العملاء والمتابعة السريعة.")}</span>
        </div>

        <form className="form-grid" onSubmit={submit}>
          <label>
            {tr("Client Name", "اسم العميل")}
            <input value={form.name} onChange={(event) => update("name", event.target.value)} required />
          </label>
          <label>
            {tr("Phone Number", "رقم الهاتف")}
            <input value={form.phone} onChange={(event) => update("phone", event.target.value)} />
          </label>
          <label className="span-2">
            {tr("Address", "العنوان")}
            <input value={form.address} onChange={(event) => update("address", event.target.value)} />
          </label>
          <label className="span-2">
            {tr("Notes", "ملاحظات")}
            <textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} />
          </label>
          <button type="submit" className="primary-btn span-2" disabled={saving}>
            <Plus size={16} />
            {saving ? tr("Saving...", "جارٍ الحفظ...") : tr("Add Contact", "إضافة عميل")}
          </button>
        </form>
      </section>

      <section className="panel table-panel">
        <div className="panel-head row-head">
          <div>
            <h3>{tr("Contacts List", "قائمة العملاء")}</h3>
            <span>{tr("Search clients and review purchase history quickly.", "ابحث عن العملاء وراجع تاريخ المشتريات بسرعة.")}</span>
          </div>
          <input
            placeholder={tr("Search contacts", "ابحث عن عميل")}
            value={query}
            onChange={(event) => onSearch(event.target.value)}
          />
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{tr("Name", "الاسم")}</th>
                <th>{tr("Phone", "الهاتف")}</th>
                <th>{tr("Address", "العنوان")}</th>
                <th>{tr("Purchases", "المشتريات")}</th>
                <th>{tr("Updated", "آخر تحديث")}</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={5}>{tr("No contacts found.", "لا توجد جهات اتصال.")}</td>
                </tr>
              ) : (
                contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td>{contact.name}</td>
                    <td>{contact.phone || "-"}</td>
                    <td>{contact.address || "-"}</td>
                    <td>{contact.purchaseHistory?.length || 0}</td>
                    <td>{formatDateTime(contact.updatedAt)}</td>
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
