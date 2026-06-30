import React, { useState } from "react";
import toast from "react-hot-toast";
import { ChevronDown, ChevronUp, Laptop, Calendar, ShieldCheck, ShieldAlert, RotateCcw, Plus } from "lucide-react";
import { formatDateTime, money } from "../utils/format";

const emptyContact = {
  name: "",
  phone: "",
  address: "",
  notes: "",
};

export default function ContactsSection({ contacts, onCreateContact, onSearch, query, lang = "en" }) {
  const [form, setForm] = useState(emptyContact);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState("");
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

  function checkWarrantyAndReturn(purchaseDateStr) {
    if (!purchaseDateStr) return { isUnderWarranty: false, isReturnAvailable: false };
    const pDate = new Date(purchaseDateStr);
    const now = new Date();

    // 3 Months Warranty Expiry
    const warrantyExpiry = new Date(pDate.getTime());
    warrantyExpiry.setMonth(warrantyExpiry.getMonth() + 3);

    // 14 Days Return/Exchange Expiry
    const returnExpiry = new Date(pDate.getTime());
    returnExpiry.setDate(returnExpiry.getDate() + 14);

    return {
      isUnderWarranty: now <= warrantyExpiry,
      isReturnAvailable: now <= returnExpiry,
      warrantyExpiryDate: warrantyExpiry.toLocaleDateString(isArabic ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      returnExpiryDate: returnExpiry.toLocaleDateString(isArabic ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    };
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
            <span>{tr("Search clients and click to review purchase history and warranty status.", "ابحث عن العملاء واضغط على الصف لعرض تفاصيل المشتريات والضمان.")}</span>
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
                <th></th>
                <th>{tr("Name", "الاسم")}</th>
                <th>{tr("Phone", "الهاتف")}</th>
                <th>{tr("Address", "العنوان")}</th>
                <th>{tr("Purchases Count", "عدد المشتريات")}</th>
                <th>{tr("Updated", "آخر تحديث")}</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={6}>{tr("No contacts found.", "لا توجد جهات اتصال.")}</td>
                </tr>
              ) : (
                contacts.map((contact) => {
                  const isExpanded = expandedId === contact.id;
                  const purchaseHistory = contact.purchaseHistory || [];

                  return (
                    <React.Fragment key={contact.id}>
                      <tr 
                        style={{ cursor: "pointer" }} 
                        onClick={() => setExpandedId(isExpanded ? "" : contact.id)}
                      >
                        <td>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </td>
                        <td style={{ fontWeight: "600" }}>{contact.name}</td>
                        <td>{contact.phone || "-"}</td>
                        <td>{contact.address || "-"}</td>
                        <td>
                          <span className="badge badge-info">
                            {purchaseHistory.length}
                          </span>
                        </td>
                        <td>{formatDateTime(contact.updatedAt)}</td>
                      </tr>

                      {isExpanded && (
                        <tr style={{ backgroundColor: "var(--bg-card-hover)" }}>
                          <td colSpan={6} style={{ padding: "1.5rem" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                              <h4 style={{ margin: 0, color: "var(--primary)", fontSize: "1.1rem" }}>
                                {tr("Devices Purchased by Client", "الأجهزة المشتراة للعميل")}
                              </h4>
                              
                              {purchaseHistory.length === 0 ? (
                                <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                                  {tr("No purchase history available for this contact.", "لا توجد سجلات شراء لهذا العميل.")}
                                </p>
                              ) : (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
                                  {purchaseHistory.map((purchase, index) => {
                                    const { isUnderWarranty, isReturnAvailable, warrantyExpiryDate, returnExpiryDate } = checkWarrantyAndReturn(purchase.purchaseDate);

                                    return (
                                      <div 
                                        key={purchase.saleId || index} 
                                        className="panel" 
                                        style={{ 
                                          padding: "1rem", 
                                          border: "1px solid var(--line)", 
                                          borderRadius: "12px",
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: "0.5rem",
                                          backgroundColor: "var(--bg-body)"
                                        }}
                                      >
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: "600" }}>
                                          <Laptop size={16} style={{ color: "var(--primary)" }} />
                                          <span>{purchase.laptopName}</span>
                                        </div>

                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                          <span>{tr("Price:", "سعر البيع:")}</span>
                                          <span style={{ fontWeight: "600", color: "var(--text-primary)" }}>
                                            {money.format(Number(purchase.sellingPrice || 0))}
                                          </span>
                                        </div>

                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                          <span>{tr("Purchase Date:", "تاريخ الشراء:")}</span>
                                          <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                            <Calendar size={12} />
                                            {purchase.purchaseDate}
                                          </span>
                                        </div>

                                        <hr style={{ border: "0", borderTop: "1px dashed var(--line)", margin: "0.5rem 0" }} />

                                        {/* 3 Months Warranty Status */}
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                          <span style={{ fontSize: "0.85rem" }}>{tr("Warranty (3 Months):", "الضمان (3 شهور):")}</span>
                                          {isUnderWarranty ? (
                                            <span style={{ color: "#10b981", display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8rem", fontWeight: "600" }}>
                                              <ShieldCheck size={14} />
                                              {tr("Active", "ساري")} ({warrantyExpiryDate})
                                            </span>
                                          ) : (
                                            <span style={{ color: "#ef4444", display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8rem", fontWeight: "600" }}>
                                              <ShieldAlert size={14} />
                                              {tr("Expired", "منتهي")} ({warrantyExpiryDate})
                                            </span>
                                          )}
                                        </div>

                                        {/* 14 Days Return/Exchange Eligibility */}
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                          <span style={{ fontSize: "0.85rem" }}>{tr("Return/Exchange (14 Days):", "الاستبدال/الاسترجاع (14 يوم):")}</span>
                                          {isReturnAvailable ? (
                                            <span style={{ color: "#10b981", display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8rem", fontWeight: "600" }}>
                                              <RotateCcw size={14} />
                                              {tr("Available", "متاح")} ({returnExpiryDate})
                                            </span>
                                          ) : (
                                            <span style={{ color: "#ef4444", display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8rem", fontWeight: "600" }}>
                                              <RotateCcw size={14} />
                                              {tr("Expired", "منتهي")} ({returnExpiryDate})
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
