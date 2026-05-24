import { useState } from "react";
import toast from "react-hot-toast";
import { FileUp, PackagePlus, Trash2 } from "lucide-react";
import { money } from "../utils/format";

function proxyImageUrl(url) {
  return url;
}

const blankProduct = {
  sku: "",
  laptopName: "",
  laptopNameAr: "",
  brand: "",
  category: "",
  categoryAr: "",
  ram: "",
  storage: "",
  purchasePrice: "",
  sellingPrice: "",
  discountPercent: "0",
  stock: "0",
  warrantyMonths: "12",
  description: "",
  descriptionAr: "",
  imageUrls: "",
  shippingInfo: "",
  shippingInfoAr: "",
  cpu: "",
  cpuAr: "",
  gpu: "",
  gpuAr: "",
  display: "",
  displayAr: "",
  os: "",
  osAr: "",
  weight: "",
  weightAr: "",
  battery: "",
  batteryAr: "",
  featured: false,
  bestOffer: false,
};

export default function ProductsSection({
  role,
  products,
  query,
  onSearch,
  onCreateProduct,
  onUpdateProduct,
  onUploadProductImages,
  onUploadExcel,
  onDeleteProduct,
  onClearProducts,
  lang = "en",
}) {
  const [manual, setManual] = useState(blankProduct);
  const [selectedImages, setSelectedImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [uploadingImagesFor, setUploadingImagesFor] = useState("");
  const isArabic = lang === "ar";
  const tr = (en, ar) => (isArabic ? ar : en);
  const canManageProducts = role === "admin" || role === "products";
  const canDeleteProducts = role === "admin";

  function update(name, value) {
    setManual((prev) => ({ ...prev, [name]: value }));
  }

  function removeImageByUrl(urlToRemove) {
    const urls = manual.imageUrls
      ? manual.imageUrls
          .split(/,+/g)
          .map((url) => url.trim())
          .filter(Boolean)
      : [];
    const updatedUrls = urls.filter((url) => url !== urlToRemove);
    update("imageUrls", updatedUrls.join(", "));
  }

  function resetForm() {
    setManual(blankProduct);
    setEditingId("");
    setSelectedImages([]);
  }

  async function submitManual(event) {
    event.preventDefault();
    if (saving) {
      return;
    }

    setSaving(true);
    try {
      let savedProduct = null;
      if (editingId) {
        savedProduct = await onUpdateProduct(editingId, manual);
        toast.success(tr("Product updated.", "تم تحديث المنتج."));
      } else {
        savedProduct = await onCreateProduct(manual);
        toast.success(tr("Product added.", "تمت إضافة المنتج."));
      }

      const targetProductId = savedProduct?.id || editingId;
      if (targetProductId && selectedImages.length > 0) {
        await onUploadProductImages(targetProductId, selectedImages);
        toast.success(tr("Product images uploaded.", "تم رفع صور المنتج."));
      }

      resetForm();
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Failed to save product.", "فشل حفظ المنتج."));
    } finally {
      setSaving(false);
    }
  }

  function startEdit(product) {
    setEditingId(product.id);
    setSelectedImages([]);
    setManual({
      sku: product.sku || "",
      laptopName: product.laptopName || "",
      laptopNameAr: product.laptopNameAr || "",
      brand: product.brand || "",
      category: product.category || "",
      categoryAr: product.categoryAr || "",
      ram: product.ram || "",
      storage: product.storage || "",
      purchasePrice: String(product.purchasePrice ?? ""),
      sellingPrice: String(product.sellingPrice ?? ""),
      discountPercent: String(product.discountPercent ?? 0),
      stock: String(product.stock ?? 0),
      warrantyMonths: String(product.warrantyMonths ?? 12),
      description: product.description || "",
      descriptionAr: product.descriptionAr || "",
      imageUrls: Array.isArray(product.imageUrls) ? product.imageUrls.join(", ") : "",
      shippingInfo: product.shippingInfo || "",
      shippingInfoAr: product.shippingInfoAr || "",
      cpu: product.specs?.cpu || "",
      cpuAr: product.specsAr?.cpu || "",
      gpu: product.specs?.gpu || "",
      gpuAr: product.specsAr?.gpu || "",
      display: product.specs?.display || "",
      displayAr: product.specsAr?.display || "",
      os: product.specs?.os || "",
      osAr: product.specsAr?.os || "",
      weight: product.specs?.weight || "",
      weightAr: product.specsAr?.weight || "",
      battery: product.specs?.battery || "",
      batteryAr: product.specsAr?.battery || "",
      featured: Boolean(product.featured),
      bestOffer: Boolean(product.bestOffer),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    resetForm();
  }

  function onSelectImages(event) {
    setSelectedImages(Array.from(event.target.files || []));
  }

  async function onUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    try {
      const result = await onUploadExcel(file);
      toast.success(
        isArabic
          ? `تم استيراد ملف الإكسيل (${result.importedCount} صف، وتم تخطي ${result.skippedCount || 0}).`
          : `Excel imported (${result.importedCount} rows, skipped ${result.skippedCount || 0}).`,
      );
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Excel upload failed.", "فشل رفع ملف الإكسيل."));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function clearCatalog() {
    if (clearing || !canDeleteProducts) {
      return;
    }

    const confirmed = window.confirm(tr("Delete all products from catalog?", "حذف كل المنتجات من الكتالوج؟"));
    if (!confirmed) {
      return;
    }

    setClearing(true);
    try {
      const removedCount = await onClearProducts();
      toast.success(
        isArabic ? `تم مسح الكتالوج (${removedCount} منتج).` : `Catalog cleared (${removedCount} removed).`,
      );
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Could not clear catalog.", "تعذر مسح الكتالوج."));
    } finally {
      setClearing(false);
    }
  }

  async function deleteSingleProduct(productId) {
    if (!productId || deletingId || !canDeleteProducts) {
      return;
    }

    const confirmed = window.confirm(tr("Delete this product?", "حذف هذا المنتج؟"));
    if (!confirmed) {
      return;
    }

    setDeletingId(productId);
    try {
      await onDeleteProduct(productId);
      toast.success(tr("Product deleted.", "تم حذف المنتج."));
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Could not delete product.", "تعذر حذف المنتج."));
    } finally {
      setDeletingId("");
    }
  }

  async function uploadImages(productId, event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) {
      return;
    }

    setUploadingImagesFor(productId);
    try {
      await onUploadProductImages(productId, files);
      toast.success(tr("Product images uploaded.", "تم رفع صور المنتج."));
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Failed to upload images.", "فشل رفع الصور."));
    } finally {
      setUploadingImagesFor("");
      event.target.value = "";
    }
  }

  return (
    <div className="section-stack">
      {canManageProducts ? (
        <section className="panel form-panel">
          <div className="panel-head">
            <h3>{editingId ? tr("Edit Product", "تعديل المنتج") : tr("Inventory Catalog", "كتالوج المخزون")}</h3>
            <span>
              {tr(
                "Upload Excel files or add products manually for quick sales lookup.",
                "ارفع ملف إكسيل أو أضف المنتجات يدويًا للبحث السريع.",
              )}
            </span>
          </div>

          <div className="inline-actions">
            <label className="upload-btn">
              <FileUp size={16} />
              {uploading ? tr("Uploading...", "جارٍ الرفع...") : tr("Upload Excel Price List", "رفع قائمة أسعار إكسيل")}
              <input type="file" accept=".xlsx,.xls" onChange={onUpload} hidden />
            </label>
            {canDeleteProducts ? (
              <button type="button" className="secondary-btn" onClick={clearCatalog} disabled={clearing}>
                <Trash2 size={16} />
                {clearing ? tr("Clearing...", "جارٍ المسح...") : tr("Clear Catalog", "مسح الكتالوج")}
              </button>
            ) : null}
          </div>

          <form className="form-grid" onSubmit={submitManual}>
            <label>
              SKU
              <input value={manual.sku} onChange={(event) => update("sku", event.target.value)} />
            </label>
            <label>
              {tr("Laptop Name", "اسم اللابتوب")}
              <input value={manual.laptopName} onChange={(event) => update("laptopName", event.target.value)} required />
            </label>
            <label>
              {tr("Laptop Name (AR)", "اسم اللابتوب بالعربي")}
              <input value={manual.laptopNameAr} onChange={(event) => update("laptopNameAr", event.target.value)} dir="rtl" />
            </label>
            <label>
              {tr("Brand", "الماركة")}
              <input value={manual.brand} onChange={(event) => update("brand", event.target.value)} required />
            </label>
            <label>
              {tr("Category", "الفئة")}
              <input value={manual.category} onChange={(event) => update("category", event.target.value)} />
            </label>
            <label>
              {tr("Category (AR)", "الفئة بالعربي")}
              <input value={manual.categoryAr} onChange={(event) => update("categoryAr", event.target.value)} dir="rtl" />
            </label>
            <label>
              RAM
              <input value={manual.ram} onChange={(event) => update("ram", event.target.value)} required />
            </label>
            <label>
              {tr("Storage", "المساحة")}
              <input value={manual.storage} onChange={(event) => update("storage", event.target.value)} required />
            </label>
            <label>
              {tr("Purchase Price", "سعر الشراء")}
              <input
                type="number"
                min="0"
                step="0.01"
                value={manual.purchasePrice}
                onChange={(event) => update("purchasePrice", event.target.value)}
                required
              />
            </label>
            <label>
              {tr("Selling Price", "سعر البيع")}
              <input
                type="number"
                min="0"
                step="0.01"
                value={manual.sellingPrice}
                onChange={(event) => update("sellingPrice", event.target.value)}
                required
              />
            </label>
            <label>
              {tr("Discount %", "الخصم %")}
              <input
                type="number"
                min="0"
                max="90"
                step="0.01"
                value={manual.discountPercent}
                onChange={(event) => update("discountPercent", event.target.value)}
              />
            </label>
            <label>
              {tr("Stock", "المخزون")}
              <input type="number" min="0" value={manual.stock} onChange={(event) => update("stock", event.target.value)} />
            </label>
            <label>
              {tr("Warranty (months)", "الضمان (بالشهور)")}
              <input
                type="number"
                min="1"
                value={manual.warrantyMonths}
                onChange={(event) => update("warrantyMonths", event.target.value)}
              />
            </label>
            <label className="span-2">
              {tr("Description", "الوصف")}
              <textarea value={manual.description} onChange={(event) => update("description", event.target.value)} />
            </label>
            <label className="span-2">
              {tr("Description (AR)", "الوصف بالعربي")}
              <textarea value={manual.descriptionAr} onChange={(event) => update("descriptionAr", event.target.value)} dir="rtl" />
            </label>
            <label className="span-2">
              {tr("Image URLs (comma separated)", "روابط الصور (مفصولة بفاصلة)")}
              <input
                value={manual.imageUrls}
                onChange={(event) => update("imageUrls", event.target.value)}
                placeholder="https://... , https://..."
              />
              {manual.imageUrls && manual.imageUrls.trim() !== "" && (
                <div className="product-images-manage">
                  {manual.imageUrls
                    .split(/,+/g)
                    .map((url) => url.trim())
                    .filter(Boolean)
                    .map((url, idx) => (
                      <div className="manage-image-card" key={idx}>
                        <img src={proxyImageUrl(url)} alt={`product-img-${idx}`} onError={(e) => { e.target.style.opacity = '0.5'; }} />
                        <button
                          type="button"
                          className="remove-btn"
                          onClick={() => removeImageByUrl(url)}
                          title={tr("Remove image", "إزالة الصورة")}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </label>
            <label className="span-2">
              {tr("Upload Images From Device", "رفع الصور من الجهاز")}
              <input type="file" accept="image/*" multiple onChange={onSelectImages} />
              <small>
                {selectedImages.length > 0
                  ? tr(`${selectedImages.length} image(s) selected.`, `تم اختيار ${selectedImages.length} صورة.`)
                  : tr(
                      "Optional: upload product images directly while saving the product.",
                      "اختياري: ارفع صور المنتج مباشرة أثناء حفظ المنتج.",
                    )}
              </small>
            </label>
            <label className="span-2">
              {tr("Shipping Info", "بيانات الشحن")}
              <input
                value={manual.shippingInfo}
                onChange={(event) => update("shippingInfo", event.target.value)}
                placeholder={tr("Ships within 1-2 business days", "الشحن خلال 1-2 يوم عمل")}
              />
            </label>
            <label className="span-2">
              {tr("Shipping Info (AR)", "بيانات الشحن بالعربي")}
              <input
                value={manual.shippingInfoAr}
                onChange={(event) => update("shippingInfoAr", event.target.value)}
                placeholder={tr("Arabic shipping text", "نص الشحن بالعربي")}
                dir="rtl"
              />
            </label>
            <label>
              CPU
              <input value={manual.cpu} onChange={(event) => update("cpu", event.target.value)} />
            </label>
            <label>
              {tr("CPU (AR)", "المعالج بالعربي")}
              <input value={manual.cpuAr} onChange={(event) => update("cpuAr", event.target.value)} dir="rtl" />
            </label>
            <label>
              GPU
              <input value={manual.gpu} onChange={(event) => update("gpu", event.target.value)} />
            </label>
            <label>
              {tr("GPU (AR)", "كارت الشاشة بالعربي")}
              <input value={manual.gpuAr} onChange={(event) => update("gpuAr", event.target.value)} dir="rtl" />
            </label>
            <label>
              {tr("Display", "الشاشة")}
              <input value={manual.display} onChange={(event) => update("display", event.target.value)} />
            </label>
            <label>
              {tr("Display (AR)", "الشاشة بالعربي")}
              <input value={manual.displayAr} onChange={(event) => update("displayAr", event.target.value)} dir="rtl" />
            </label>
            <label>
              OS
              <input value={manual.os} onChange={(event) => update("os", event.target.value)} />
            </label>
            <label>
              {tr("OS (AR)", "نظام التشغيل بالعربي")}
              <input value={manual.osAr} onChange={(event) => update("osAr", event.target.value)} dir="rtl" />
            </label>
            <label>
              {tr("Weight", "الوزن")}
              <input value={manual.weight} onChange={(event) => update("weight", event.target.value)} />
            </label>
            <label>
              {tr("Weight (AR)", "الوزن بالعربي")}
              <input value={manual.weightAr} onChange={(event) => update("weightAr", event.target.value)} dir="rtl" />
            </label>
            <label>
              {tr("Battery", "البطارية")}
              <input value={manual.battery} onChange={(event) => update("battery", event.target.value)} />
            </label>
            <label>
              {tr("Battery (AR)", "البطارية بالعربي")}
              <input value={manual.batteryAr} onChange={(event) => update("batteryAr", event.target.value)} dir="rtl" />
            </label>
            <label className="checkbox-field">
              <input type="checkbox" checked={manual.featured} onChange={(event) => update("featured", event.target.checked)} />
              {tr("Featured", "مميز")}
            </label>
            <label className="checkbox-field">
              <input type="checkbox" checked={manual.bestOffer} onChange={(event) => update("bestOffer", event.target.checked)} />
              {tr("Best Offer", "أفضل عرض")}
            </label>

            <button className="primary-btn span-2" type="submit" disabled={saving}>
              <PackagePlus size={16} />
              {saving
                ? tr("Saving...", "جارٍ الحفظ...")
                : editingId
                  ? tr("Save Changes", "حفظ التعديلات")
                  : tr("Add Product", "إضافة منتج")}
            </button>
            {editingId ? (
              <button className="secondary-btn span-2" type="button" onClick={cancelEdit}>
                {tr("Cancel Edit", "إلغاء التعديل")}
              </button>
            ) : null}
          </form>
        </section>
      ) : null}

      <section className="panel table-panel">
        <div className="panel-head row-head">
          <div>
            <h3>{tr("Search Products", "البحث في المنتجات")}</h3>
            <span>
              {tr(
                "Quick product lookup by SKU, model, brand, RAM, or storage.",
                "بحث سريع حسب الكود أو الموديل أو الماركة أو الرام أو المساحة.",
              )}
            </span>
          </div>
          <input placeholder={tr("Search products", "ابحث عن منتج")} value={query} onChange={(event) => onSearch(event.target.value)} />
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>{tr("Model", "الموديل")}</th>
                <th>{tr("Brand", "الماركة")}</th>
                <th>{tr("Category", "الفئة")}</th>
                <th>RAM</th>
                <th>{tr("Storage", "المساحة")}</th>
                <th>{tr("Sell Price", "سعر البيع")}</th>
                <th>{tr("Discount", "الخصم")}</th>
                {canManageProducts ? <th>{tr("Purchase Price", "سعر الشراء")}</th> : null}
                <th>{tr("Stock", "المخزون")}</th>
                <th>{tr("Images", "الصور")}</th>
                {canManageProducts ? <th>{tr("Actions", "الإجراءات")}</th> : null}
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={canManageProducts ? 12 : 10}>{tr("No products found.", "لا توجد منتجات.")}</td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id}>
                    <td>{product.sku}</td>
                    <td>{product.laptopName}</td>
                    <td>{product.brand}</td>
                    <td>{product.category || "-"}</td>
                    <td>{product.ram}</td>
                    <td>{product.storage}</td>
                    <td>{money.format(Number(product.sellingPrice || 0))}</td>
                    <td>{Number(product.discountPercent || 0)}%</td>
                    {canManageProducts ? <td>{money.format(Number(product.purchasePrice || 0))}</td> : null}
                    <td className={Number(product.stock) <= 3 ? "danger-text" : ""}>{product.stock}</td>
                    <td>{Array.isArray(product.imageUrls) ? product.imageUrls.length : 0}</td>
                    {canManageProducts ? (
                      <td>
                        <div className="table-actions">
                          <button type="button" className="secondary-btn" onClick={() => startEdit(product)}>
                            {tr("Edit", "تعديل")}
                          </button>
                          <label className="upload-btn">
                            {uploadingImagesFor === product.id ? tr("Uploading...", "جارٍ الرفع...") : tr("Images", "صور")}
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              hidden
                              disabled={uploadingImagesFor === product.id}
                              onChange={(event) => uploadImages(product.id, event)}
                            />
                          </label>
                          {canDeleteProducts ? (
                            <button
                              type="button"
                              className="secondary-btn danger-outline"
                              onClick={() => deleteSingleProduct(product.id)}
                              disabled={deletingId === product.id}
                            >
                              <Trash2 size={14} />
                              {deletingId === product.id ? tr("Deleting...", "جارٍ الحذف...") : tr("Delete", "حذف")}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
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
