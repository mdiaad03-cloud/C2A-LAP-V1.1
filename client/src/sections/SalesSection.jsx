import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Filter, Plus } from "lucide-react";
import { formatDate, money } from "../utils/format";

const emptySale = {
  productId: "",
  laptopName: "",
  brand: "",
  ram: "",
  storage: "",
  purchasePrice: "",
  sellingPrice: "",
  shippingCost: "0",
  purchaseDate: "",
  warrantyMonths: "12",
  clientName: "",
  clientPhone: "",
  clientAddress: "",
  notes: "",
  shippingCompanyName: "",
  shippingCompanyPhone: "",
  trackingNumber: "",
  representativeName: "",
};

export default function SalesSection({
  sales,
  products,
  shippingCompanies,
  users,
  filters,
  onFiltersChange,
  onCreateSale,
  canViewFinance,
  role,
  lang = "en",
}) {
  const [form, setForm] = useState(emptySale);
  const [saving, setSaving] = useState(false);
  const isArabic = lang === "ar";
  const tr = (en, ar) => (isArabic ? ar : en);

  const brands = useMemo(() => {
    const fromSales = sales.map((sale) => sale.brand);
    const fromProducts = products.map((product) => product.brand);
    return [...new Set([...fromSales, ...fromProducts].filter(Boolean))];
  }, [sales, products]);

  function updateForm(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function applyProduct(productId) {
    const product = products.find((entry) => entry.id === productId);
    if (!product) {
      return;
    }

    setForm((prev) => ({
      ...prev,
      productId,
      laptopName: product.laptopName || "",
      brand: product.brand || "",
      ram: product.ram || "",
      storage: product.storage || "",
      purchasePrice: String(product.purchasePrice ?? ""),
      sellingPrice: String(product.sellingPrice ?? ""),
      warrantyMonths: String(product.warrantyMonths ?? 12),
    }));
  }

  async function submitSale(event) {
    event.preventDefault();
    if (saving) {
      return;
    }

    setSaving(true);
    try {
      await onCreateSale({
        ...form,
        purchasePrice: form.purchasePrice || 0,
      });
      setForm(emptySale);
      toast.success(tr("Sale added successfully.", "تمت إضافة عملية البيع بنجاح."));
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Failed to add sale.", "فشل إضافة عملية البيع."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="section-stack">
      <section className="panel form-panel">
        <div className="panel-head">
          <h3>{tr("Sales Entry", "إدخال عملية بيع")}</h3>
          <span>{tr("Track every laptop sale with warranty and shipping details.", "سجل كل عملية بيع مع الضمان وبيانات الشحن.")}</span>
        </div>

        <form className="form-grid" onSubmit={submitSale}>
          <label>
            {tr("Product from Excel Catalog", "منتج من ملف الإكسيل")}
            <select
              value={form.productId}
              onChange={(event) => applyProduct(event.target.value)}
            >
              <option value="">{tr("Manual entry", "إدخال يدوي")}</option>
              {products.slice(0, 400).map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} - {product.laptopName}
                </option>
              ))}
            </select>
          </label>

          <label>
            {tr("Laptop Name", "اسم اللابتوب")}
            <input
              value={form.laptopName}
              onChange={(event) => updateForm("laptopName", event.target.value)}
              required
            />
          </label>

          <label>
            {tr("Brand", "الماركة")}
            <input
              value={form.brand}
              onChange={(event) => updateForm("brand", event.target.value)}
              required
            />
          </label>

          <label>
            {tr("RAM", "الرام")}
            <input value={form.ram} onChange={(event) => updateForm("ram", event.target.value)} required />
          </label>

          <label>
            {tr("Storage", "المساحة")}
            <input
              value={form.storage}
              onChange={(event) => updateForm("storage", event.target.value)}
              required
            />
          </label>

          {canViewFinance ? (
            <label>
              {tr("Purchase Price", "سعر الشراء")}
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.purchasePrice}
                onChange={(event) => updateForm("purchasePrice", event.target.value)}
                required
              />
            </label>
          ) : null}

          <label>
            {tr("Selling Price", "سعر البيع")}
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.sellingPrice}
              onChange={(event) => updateForm("sellingPrice", event.target.value)}
              required
            />
          </label>

          <label>
            {tr("Shipping Cost", "تكلفة الشحن")}
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.shippingCost}
              onChange={(event) => updateForm("shippingCost", event.target.value)}
            />
          </label>

          <label>
            {tr("Purchase Date", "تاريخ الشراء")}
            <input
              type="date"
              value={form.purchaseDate}
              onChange={(event) => updateForm("purchaseDate", event.target.value)}
            />
          </label>

          <label>
            {tr("Warranty (months)", "الضمان (بالشهور)")}
            <input
              type="number"
              min="1"
              value={form.warrantyMonths}
              onChange={(event) => updateForm("warrantyMonths", event.target.value)}
              required
            />
          </label>

          <label>
            {tr("Client Name", "اسم العميل")}
            <input
              value={form.clientName}
              onChange={(event) => updateForm("clientName", event.target.value)}
            />
          </label>

          <label>
            {tr("Client Phone", "هاتف العميل")}
            <input
              value={form.clientPhone}
              onChange={(event) => updateForm("clientPhone", event.target.value)}
            />
          </label>

          <label>
            {tr("Client Address", "عنوان العميل")}
            <input
              value={form.clientAddress}
              onChange={(event) => updateForm("clientAddress", event.target.value)}
            />
          </label>

          <label>
            {tr("Shipping Company", "شركة الشحن")}
            <input
              list="shipping-company-list"
              value={form.shippingCompanyName}
              onChange={(event) => updateForm("shippingCompanyName", event.target.value)}
            />
            <datalist id="shipping-company-list">
              {shippingCompanies.map((company) => (
                <option key={company.id} value={company.name} />
              ))}
            </datalist>
          </label>

          <label>
            {tr("Shipping Phone", "هاتف الشحن")}
            <input
              value={form.shippingCompanyPhone}
              onChange={(event) => updateForm("shippingCompanyPhone", event.target.value)}
            />
          </label>

          <label>
            {tr("Tracking Number", "رقم التتبع")}
            <input
              value={form.trackingNumber}
              onChange={(event) => updateForm("trackingNumber", event.target.value)}
            />
          </label>

          <label>
            {tr("Representative", "المندوب")}
            <input
              value={form.representativeName}
              onChange={(event) => updateForm("representativeName", event.target.value)}
            />
          </label>

          <label className="span-2">
            {tr("Notes", "ملاحظات")}
            <textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} />
          </label>

          <button type="submit" className="primary-btn span-2" disabled={saving}>
            <Plus size={16} />
            {saving ? tr("Saving...", "جارٍ الحفظ...") : tr("Add Sale", "إضافة عملية بيع")}
          </button>
        </form>
      </section>

      <section className="panel table-panel">
        <div className="panel-head row-head">
          <div>
            <h3>{tr("Sales Records", "سجلات المبيعات")}</h3>
            <span>{tr("Search by date, brand, employee, and warranty status.", "ابحث بالتاريخ أو الماركة أو الموظف أو حالة الضمان.")}</span>
          </div>
          <div className="filters-inline">
            <Filter size={14} />
            <input
              placeholder={tr("Search", "بحث")}
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
            {tr("Brand", "الماركة")}
            <select
              value={filters.brand || ""}
              onChange={(event) => onFiltersChange({ ...filters, brand: event.target.value })}
            >
              <option value="">{tr("All", "الكل")}</option>
              {brands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </label>

          {role === "admin" ? (
            <label>
              {tr("Employee", "الموظف")}
              <select
                value={filters.employee || ""}
                onChange={(event) => onFiltersChange({ ...filters, employee: event.target.value })}
              >
                <option value="">{tr("All", "الكل")}</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label>
            {tr("Warranty", "الضمان")}
            <select
              value={filters.warrantyStatus || ""}
              onChange={(event) => onFiltersChange({ ...filters, warrantyStatus: event.target.value })}
            >
              <option value="">{tr("All", "الكل")}</option>
              <option value="active">{tr("Active", "ساري")}</option>
              <option value="expired">{tr("Expired", "منتهي")}</option>
              <option value="return-expired">{tr("Return Expired", "انتهت مدة الإرجاع")}</option>
              <option value="replacement-expired">{tr("Replacement Expired", "انتهت مدة الاستبدال")}</option>
            </select>
          </label>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{tr("Date", "التاريخ")}</th>
                <th>{tr("Laptop", "اللابتوب")}</th>
                <th>{tr("Brand", "الماركة")}</th>
                <th>{tr("Sell", "البيع")}</th>
                {canViewFinance ? <th>{tr("Profit", "الربح")}</th> : null}
                <th>{tr("Warranty Days", "أيام الضمان")}</th>
                <th>{tr("Replacement", "الاستبدال")}</th>
                <th>{tr("Return", "الإرجاع")}</th>
                <th>{tr("Employee", "الموظف")}</th>
                <th>{tr("Source", "المصدر")}</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={canViewFinance ? 10 : 9}>{tr("No sales found.", "لا توجد عمليات بيع.")}</td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id}>
                    <td>{formatDate(sale.purchaseDate)}</td>
                    <td>{sale.laptopName}</td>
                    <td>{sale.brand}</td>
                    <td>{money.format(Number(sale.sellingPrice || 0))}</td>
                    {canViewFinance ? <td>{money.format(Number(sale.profit || 0))}</td> : null}
                    <td>{sale.warrantyDaysRemaining}</td>
                    <td className={sale.replacementExpired ? "danger-text" : "success-text"}>
                      {sale.replacementExpired ? tr("Replacement expired", "انتهت الاستبدال") : sale.replacementDeadline}
                    </td>
                    <td className={sale.returnExpired ? "danger-text" : "success-text"}>
                      {sale.returnExpired ? tr("Return expired", "انتهت الإرجاع") : sale.returnDeadline}
                    </td>
                    <td>{sale.createdByName}</td>
                    <td>
                      {sale.source === "online-store"
                        ? `${tr("Online", "أونلاين")} (${sale.onlineOrderStatus || tr("pending", "معلق")})`
                        : tr("Manual", "يدوي")}
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
