import { useMemo, useState, useRef } from "react";
import toast from "react-hot-toast";
import { Bot, PackagePlus, Send, Truck, Upload } from "lucide-react";
import { formatDateTime, money } from "../utils/format";

const blankProductInput = {
  sku: "",
  brand: "",
  model: "",
  modelAr: "",
  category: "",
  categoryAr: "",
  ram: "",
  storage: "",
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
  purchasePrice: "",
  sellingPrice: "",
  discountPercent: "0",
  stock: "0",
  warrantyMonths: "12",
  imageUrls: "",
  shippingInfo: "",
  shippingInfoAr: "",
  featured: false,
  bestOffer: false,
};

const defaultAgentSettings = {
  productDraftEnabled: true,
  supportReplyEnabled: true,
  shippingAgentEnabled: true,
  excelImportEnabled: true,
  autoMoveTicketsToInProgress: true,
  defaultShippingCompanyName: "Bosta",
  defaultShippingStatus: "pickup_requested",
  productDescriptionTone: "professional",
  supportReplyTone: "friendly",
};

function latestMessage(ticket) {
  return Array.isArray(ticket?.messages) && ticket.messages.length > 0
    ? ticket.messages[0]?.body || ""
    : "";
}

function defaultShippingDraft(order, settings = defaultAgentSettings) {
  return {
    shippingCompanyName: order.shippingCompanyName || settings.defaultShippingCompanyName || "",
    shippingCompanyPhone: order.shippingCompanyPhone || "",
    trackingNumber: order.trackingNumber || "",
    shippingStatus: order.shippingStatus || settings.defaultShippingStatus || "pickup_requested",
  };
}

export default function AgentSection({
  tickets = [],
  orders = [],
  onGenerateProductDraft,
  onImportExcel,
  onCreateProduct,
  onUploadProductImages,
  onGenerateSupportReply,
  onAutoReplyTicket,
  onReplyTicket,
  onUpdateTicket,
  onUpdateOrder,
  onGenerateShippingDraft,
  onCreateBostaShipment,
  settings,
  lang = "en",
  onSelectTab,
}) {
  const isArabic = lang === "ar";
  const tr = (en, ar) => (isArabic ? ar : en);
  const agentSettings = useMemo(
    () => ({
      ...defaultAgentSettings,
      ...(settings || {}),
    }),
    [settings],
  );

  const [productInput, setProductInput] = useState(blankProductInput);
  const [productDraft, setProductDraft] = useState(null);
  const [selectedImages, setSelectedImages] = useState([]);
  const [excelFile, setExcelFile] = useState(null);
  const [productGenerating, setProductGenerating] = useState(false);
  const [productSaving, setProductSaving] = useState(false);
  const [excelImporting, setExcelImporting] = useState(false);

  const imageInputRef = useRef(null);
  const excelInputRef = useRef(null);

  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyLoadingId, setReplyLoadingId] = useState("");
  const [replySendingId, setReplySendingId] = useState("");

  const [shippingDrafts, setShippingDrafts] = useState({});
  const [shippingLoadingId, setShippingLoadingId] = useState("");
  const [shippingSavingId, setShippingSavingId] = useState("");
  const [bostaSavingId, setBostaSavingId] = useState("");

  const actionableTickets = useMemo(
    () => tickets.filter((ticket) => ["open", "in_progress"].includes(ticket.status)).slice(0, 8),
    [tickets],
  );

  const shippableOrders = useMemo(
    () => orders.filter((order) => ["confirmed", "shipped"].includes(order.status)).slice(0, 8),
    [orders],
  );

  function updateProductInput(name, value) {
    setProductInput((prev) => ({ ...prev, [name]: value }));
  }

  function updateProductDraft(name, value) {
    setProductDraft((prev) => ({ ...(prev || {}), [name]: value }));
  }

  async function generateProductDraft(event) {
    event?.preventDefault?.();
    if (!agentSettings.productDraftEnabled) {
      toast.error(tr("Product agent is disabled in settings.", "وكيل المنتجات متوقف من الإعدادات."));
      return;
    }

    setProductGenerating(true);
    try {
      const draft = await onGenerateProductDraft(productInput);
      setProductDraft(draft);
      toast.success(tr("Product draft generated.", "تم توليد مسودة المنتج."));
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Could not generate product draft.", "تعذر توليد مسودة المنتج."));
    } finally {
      setProductGenerating(false);
    }
  }

  async function importExcelWithAgent() {
    if (!excelFile || excelImporting || !agentSettings.excelImportEnabled || typeof onImportExcel !== "function") {
      return;
    }

    setExcelImporting(true);
    try {
      const result = await onImportExcel(excelFile);
      setExcelFile(null);
      if (excelInputRef.current) {
        excelInputRef.current.value = "";
      }
      toast.success(
        tr(
          `Excel processed: ${result?.importedCount || 0} added, ${result?.updatedCount || 0} updated.`,
          `تمت معالجة الإكسل: إضافة ${result?.importedCount || 0} وتحديث ${result?.updatedCount || 0}.`,
        ),
      );
      if (typeof onSelectTab === "function") {
        onSelectTab("products");
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Could not import Excel file.", "تعذر استيراد ملف الإكسل."));
    } finally {
      setExcelImporting(false);
    }
  }

  async function createProductFromDraft() {
    if (!productDraft || productSaving || !agentSettings.productDraftEnabled) {
      return;
    }

    setProductSaving(true);
    try {
      const savedProduct = await onCreateProduct(productDraft);
      if (savedProduct?.id && selectedImages.length > 0) {
        await onUploadProductImages(savedProduct.id, selectedImages);
      }
      setProductInput(blankProductInput);
      setProductDraft(null);
      setSelectedImages([]);
      setExcelFile(null);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
      if (excelInputRef.current) {
        excelInputRef.current.value = "";
      }
      toast.success(tr("Agent created the product successfully.", "تمت إضافة المنتج عبر الإيجنت بنجاح."));
      if (typeof onSelectTab === "function") {
        onSelectTab("products");
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Agent could not create product.", "تعذر على الإيجنت إضافة المنتج."));
    } finally {
      setProductSaving(false);
    }
  }

  async function generateReply(ticket) {
    if (!agentSettings.supportReplyEnabled) {
      toast.error(tr("Support agent is disabled in settings.", "وكيل الدعم متوقف من الإعدادات."));
      return;
    }

    setReplyLoadingId(ticket.id);
    try {
      const suggestion = await onGenerateSupportReply(ticket.id);
      setReplyDrafts((prev) => ({
        ...prev,
        [ticket.id]: {
          suggestion,
          text: isArabic ? suggestion.replyAr : suggestion.reply,
        },
      }));
      toast.success(tr("Reply draft is ready.", "مسودة الرد جاهزة."));
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Could not generate reply.", "تعذر توليد الرد."));
    } finally {
      setReplyLoadingId("");
    }
  }

  function updateReplyText(ticketId, value) {
    setReplyDrafts((prev) => ({
      ...prev,
      [ticketId]: {
        ...(prev[ticketId] || {}),
        text: value,
      },
    }));
  }

  async function sendReply(ticket) {
    const draft = replyDrafts[ticket.id];
    const body = String(draft?.text || "").trim();
    if (!body || replySendingId || !agentSettings.supportReplyEnabled) {
      return;
    }

    setReplySendingId(ticket.id);
    try {
      if (
        agentSettings.autoMoveTicketsToInProgress
        && draft?.suggestion?.recommendedStatus
        && draft.suggestion.recommendedStatus !== ticket.status
        && typeof onUpdateTicket === "function"
      ) {
        await onUpdateTicket(ticket.id, { status: draft.suggestion.recommendedStatus });
      }

      await onReplyTicket(ticket.id, body);
      setReplyDrafts((prev) => {
        const next = { ...prev };
        delete next[ticket.id];
        return next;
      });
      toast.success(tr("Reply sent to customer.", "تم إرسال الرد للعميل."));
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Could not send reply.", "تعذر إرسال الرد."));
    } finally {
      setReplySendingId("");
    }
  }

  async function autoReply(ticket) {
    if (replySendingId || !agentSettings.supportReplyEnabled || typeof onAutoReplyTicket !== "function") {
      return;
    }

    setReplySendingId(ticket.id);
    try {
      const draft = replyDrafts[ticket.id];
      const body = String(draft?.text || "").trim();
      await onAutoReplyTicket(ticket.id, body || undefined);
      setReplyDrafts((prev) => {
        const next = { ...prev };
        delete next[ticket.id];
        return next;
      });
      toast.success(tr("Automatic reply sent.", "تم إرسال الرد التلقائي."));
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Could not send automatic reply.", "تعذر إرسال الرد التلقائي."));
    } finally {
      setReplySendingId("");
    }
  }

  async function prepareShipping(order) {
    if (!agentSettings.shippingAgentEnabled) {
      toast.error(tr("Shipping agent is disabled in settings.", "وكيل الشحن متوقف من الإعدادات."));
      return;
    }

    setShippingLoadingId(order.id);
    try {
      const draft = await onGenerateShippingDraft(order.id);
      setShippingDrafts((prev) => ({
        ...prev,
        [order.id]: {
          ...defaultShippingDraft(order, agentSettings),
          ...draft,
        },
      }));
      toast.success(tr("Shipping draft is ready.", "مسودة الشحن جاهزة."));
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Could not prepare shipping draft.", "تعذر تجهيز مسودة الشحن."));
    } finally {
      setShippingLoadingId("");
    }
  }

  function updateShippingDraft(orderId, name, value) {
    setShippingDrafts((prev) => ({
      ...prev,
      [orderId]: {
        ...(prev[orderId] || defaultShippingDraft({}, agentSettings)),
        [name]: value,
      },
    }));
  }

  async function confirmShipment(order) {
    const draft = shippingDrafts[order.id] || defaultShippingDraft(order, agentSettings);
    if (shippingSavingId || !agentSettings.shippingAgentEnabled) {
      return;
    }

    setShippingSavingId(order.id);
    try {
      const payload = {
        status: "shipped",
        shippingStatus: draft.shippingStatus || agentSettings.defaultShippingStatus || "in_transit",
        shippingCompanyName: draft.shippingCompanyName || "",
        shippingCompanyPhone: draft.shippingCompanyPhone || "",
        trackingNumber: draft.trackingNumber || "",
        paymentStatus: order.paymentStatus || "pending_collection",
      };

      if (order.assignedEmployeeId) {
        payload.assignedEmployeeId = order.assignedEmployeeId;
      }

      await onUpdateOrder(order.id, payload);
      toast.success(tr("Shipment confirmed.", "تم تأكيد الشحنة."));
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Could not confirm shipment.", "تعذر تأكيد الشحنة."));
    } finally {
      setShippingSavingId("");
    }
  }

  async function createBostaShipment(order) {
    if (bostaSavingId || typeof onCreateBostaShipment !== "function") {
      return;
    }

    setBostaSavingId(order.id);
    try {
      await onCreateBostaShipment(order.id, {});
      toast.success(tr("Bosta shipment created.", "تم إنشاء شحنة بوسطة."));
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Could not create Bosta shipment.", "تعذر إنشاء شحنة بوسطة."));
    } finally {
      setBostaSavingId("");
    }
  }

  return (
    <div className="section-stack">
      <section className="panel">
        <div className="panel-head">
          <h3>{tr("Operations Agent", "إيجنت العمليات")}</h3>
          <span>
            {tr(
              "Use one workspace to draft products, import Excel stock, reply to customers, and prepare shipments.",
              "استخدم مساحة واحدة لتجهيز المنتجات، واستيراد الإكسل، والرد على العملاء، وتجهيز الشحن.",
            )}
          </span>
        </div>

        <div className="agent-suggestion-box">
          <div className="agent-suggestion-head">
            <strong>{tr("Current Settings", "الإعدادات الحالية")}</strong>
            <span>{tr("Managed from Store Settings → Agent Settings.", "تُدار من إعدادات المتجر ← إعدادات الإيجنت.")}</span>
          </div>
          <div className="agent-settings-summary">
            <span className={`status-pill ${agentSettings.productDraftEnabled ? "status-confirmed" : "status-cancelled"}`}>
              {tr("Products", "المنتجات")} · {agentSettings.productDraftEnabled ? tr("On", "مفعل") : tr("Off", "متوقف")}
            </span>
            <span className={`status-pill ${agentSettings.supportReplyEnabled ? "status-confirmed" : "status-cancelled"}`}>
              {tr("Support", "الدعم")} · {agentSettings.supportReplyEnabled ? tr("On", "مفعل") : tr("Off", "متوقف")}
            </span>
            <span className={`status-pill ${agentSettings.shippingAgentEnabled ? "status-confirmed" : "status-cancelled"}`}>
              {tr("Shipping", "الشحن")} · {agentSettings.shippingAgentEnabled ? tr("On", "مفعل") : tr("Off", "متوقف")}
            </span>
            <span className="status-pill status-pending">
              {tr("Default Carrier", "شركة الشحن الافتراضية")} · {agentSettings.defaultShippingCompanyName}
            </span>
          </div>
        </div>

        <div className="agent-grid">
          <article className="agent-card">
            <div className="agent-card-head">
              <div>
                <h4>{tr("Product Agent", "إيجنت المنتجات")}</h4>
                <p>
                  {tr(
                    "Generate product drafts from raw specs, or upload Excel and let the agent add/update stock.",
                    "ولّد مسودات المنتجات من المواصفات، أو ارفع Excel واترك الإيجنت يضيف أو يحدّث المنتجات.",
                  )}
                </p>
              </div>
              <span className="agent-icon-badge">
                <PackagePlus size={18} />
              </span>
            </div>

            <form className="form-grid" onSubmit={generateProductDraft}>
              <label>
                {tr("Brand", "الماركة")}
                <input value={productInput.brand} onChange={(event) => updateProductInput("brand", event.target.value)} required />
              </label>
              <label>
                {tr("Model", "الموديل")}
                <input value={productInput.model} onChange={(event) => updateProductInput("model", event.target.value)} required />
              </label>
              <label>
                {tr("Model (AR)", "الموديل بالعربي")}
                <input value={productInput.modelAr} onChange={(event) => updateProductInput("modelAr", event.target.value)} dir="rtl" />
              </label>
              <label>
                {tr("Category", "الفئة")}
                <input value={productInput.category} onChange={(event) => updateProductInput("category", event.target.value)} />
              </label>
              <label>
                {tr("RAM", "الرام")}
                <input value={productInput.ram} onChange={(event) => updateProductInput("ram", event.target.value)} required />
              </label>
              <label>
                {tr("Storage", "المساحة")}
                <input value={productInput.storage} onChange={(event) => updateProductInput("storage", event.target.value)} required />
              </label>
              <label>
                CPU
                <input value={productInput.cpu} onChange={(event) => updateProductInput("cpu", event.target.value)} />
              </label>
              <label>
                GPU
                <input value={productInput.gpu} onChange={(event) => updateProductInput("gpu", event.target.value)} />
              </label>
              <label>
                {tr("Purchase Price", "سعر الشراء")}
                <input type="number" min="0" step="0.01" value={productInput.purchasePrice} onChange={(event) => updateProductInput("purchasePrice", event.target.value)} />
              </label>
              <label>
                {tr("Selling Price", "سعر البيع")}
                <input type="number" min="0" step="0.01" value={productInput.sellingPrice} onChange={(event) => updateProductInput("sellingPrice", event.target.value)} />
              </label>
              <label>
                {tr("Stock", "المخزون")}
                <input type="number" min="0" value={productInput.stock} onChange={(event) => updateProductInput("stock", event.target.value)} />
              </label>
              <label>
                {tr("Warranty Months", "مدة الضمان بالشهور")}
                <input type="number" min="1" value={productInput.warrantyMonths} onChange={(event) => updateProductInput("warrantyMonths", event.target.value)} />
              </label>
              <label className="span-2">
                {tr("Image URLs", "روابط الصور")}
                <input value={productInput.imageUrls} onChange={(event) => updateProductInput("imageUrls", event.target.value)} placeholder="https://..." />
              </label>
              <label className="span-2" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {tr("Upload Images From Device", "رفع الصور من الجهاز")}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => setSelectedImages(Array.from(event.target.files || []))}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => imageInputRef.current?.click()}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  <Upload size={16} />
                  {selectedImages.length > 0
                    ? tr(`${selectedImages.length} images selected`, `${selectedImages.length} صور تم اختيارها`)
                    : tr("Choose Images", "اختر الصور")}
                </button>
              </label>
              <label className="span-2" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {tr("Import Products Excel", "استيراد ملف Excel للمنتجات")}
                <input
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(event) => setExcelFile(event.target.files?.[0] || null)}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => excelInputRef.current?.click()}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  <Upload size={16} />
                  {excelFile
                    ? excelFile.name
                    : tr("Choose Excel File", "اختر ملف Excel")}
                </button>
                <small style={{ marginTop: "4px" }}>
                  {tr("Upload one sheet and let the agent add or update products automatically.", "ارفع ملفًا واحدًا ودع الإيجنت يضيف أو يحدّث المنتجات تلقائيًا.")}
                </small>
              </label>

              <button type="submit" className="primary-btn span-2" disabled={productGenerating || !agentSettings.productDraftEnabled}>
                <Bot size={16} />
                {productGenerating ? tr("Generating...", "جارٍ التوليد...") : tr("Generate Draft", "توليد مسودة")}
              </button>

              <button
                type="button"
                className="secondary-btn span-2"
                onClick={importExcelWithAgent}
                disabled={!excelFile || excelImporting || !agentSettings.excelImportEnabled}
              >
                <Upload size={16} />
                {excelImporting ? tr("Importing...", "جارٍ الاستيراد...") : tr("Import Excel Through Agent", "استيراد الإكسل عبر الإيجنت")}
              </button>
            </form>

            {productDraft ? (
              <div className="agent-suggestion-box">
                <div className="agent-suggestion-head">
                  <strong>{tr("Agent Draft", "مسودة الإيجنت")}</strong>
                  <span>{tr("You can still edit before saving.", "يمكنك التعديل قبل الحفظ.")}</span>
                </div>

                <div className="form-grid">
                  <label>
                    {tr("Laptop Name", "اسم اللاب توب")}
                    <input value={productDraft.laptopName || ""} onChange={(event) => updateProductDraft("laptopName", event.target.value)} />
                  </label>
                  <label>
                    {tr("Laptop Name (AR)", "اسم اللاب توب بالعربي")}
                    <input value={productDraft.laptopNameAr || ""} dir="rtl" onChange={(event) => updateProductDraft("laptopNameAr", event.target.value)} />
                  </label>
                  <label className="span-2">
                    {tr("Description", "الوصف")}
                    <textarea value={productDraft.description || ""} onChange={(event) => updateProductDraft("description", event.target.value)} />
                  </label>
                  <label className="span-2">
                    {tr("Description (AR)", "الوصف بالعربي")}
                    <textarea value={productDraft.descriptionAr || ""} dir="rtl" onChange={(event) => updateProductDraft("descriptionAr", event.target.value)} />
                  </label>
                  <label className="span-2">
                    {tr("Shipping Info", "معلومات الشحن")}
                    <input value={productDraft.shippingInfo || ""} onChange={(event) => updateProductDraft("shippingInfo", event.target.value)} />
                  </label>
                  <label className="span-2">
                    {tr("Shipping Info (AR)", "معلومات الشحن بالعربي")}
                    <input value={productDraft.shippingInfoAr || ""} dir="rtl" onChange={(event) => updateProductDraft("shippingInfoAr", event.target.value)} />
                  </label>
                </div>

                <div className="inline-actions">
                  <button type="button" className="primary-btn" onClick={createProductFromDraft} disabled={productSaving || !agentSettings.productDraftEnabled}>
                    <PackagePlus size={16} />
                    {productSaving ? tr("Saving...", "جارٍ الحفظ...") : tr("Create Product", "إضافة المنتج")}
                  </button>
                  <button type="button" className="secondary-btn" onClick={() => setProductDraft(null)}>
                    {tr("Discard Draft", "إلغاء المسودة")}
                  </button>
                </div>
              </div>
            ) : null}
          </article>

          <article className="agent-card">
            <div className="agent-card-head">
              <div>
                <h4>{tr("Support Agent", "إيجنت الدعم")}</h4>
                <p>
                  {tr(
                    "Generate or send support replies automatically based on the latest ticket context.",
                    "ولّد أو أرسل ردود الدعم تلقائيًا بناءً على آخر رسالة في الشكوى.",
                  )}
                </p>
              </div>
              <span className="agent-icon-badge">
                <Send size={18} />
              </span>
            </div>

            <div className="agent-list">
              {actionableTickets.length === 0 ? (
                <p className="empty-note">{tr("No open tickets are waiting for the agent.", "لا توجد شكاوى مفتوحة بانتظار الإيجنت.")}</p>
              ) : (
                actionableTickets.map((ticket) => {
                  const draft = replyDrafts[ticket.id];
                  return (
                    <div key={ticket.id} className="agent-list-item">
                      <div className="agent-list-head">
                        <div>
                          <strong>{ticket.subject}</strong>
                          <span>{ticket.customerName} · {formatDateTime(ticket.updatedAt)}</span>
                        </div>
                        <span className={`status-pill status-${ticket.status}`}>{ticket.status}</span>
                      </div>
                      <p className="agent-ticket-message">{latestMessage(ticket)}</p>

                      {!draft ? (
                        <button type="button" className="secondary-btn" onClick={() => generateReply(ticket)} disabled={replyLoadingId === ticket.id || !agentSettings.supportReplyEnabled}>
                          <Bot size={15} />
                          {replyLoadingId === ticket.id ? tr("Generating...", "جارٍ التوليد...") : tr("Generate Reply", "توليد رد")}
                        </button>
                      ) : (
                        <div className="agent-suggestion-box">
                          <div className="agent-suggestion-head">
                            <strong>{tr("Suggested Reply", "الرد المقترح")}</strong>
                            <span>{tr("Topic", "النوع")}: {draft.suggestion?.topic || "-"}</span>
                          </div>
                          <textarea value={draft.text || ""} onChange={(event) => updateReplyText(ticket.id, event.target.value)} />
                          <div className="inline-actions">
                            <button type="button" className="primary-btn" onClick={() => sendReply(ticket)} disabled={replySendingId === ticket.id || !agentSettings.supportReplyEnabled}>
                              <Send size={15} />
                              {replySendingId === ticket.id ? tr("Sending...", "جارٍ الإرسال...") : tr("Send Reply", "إرسال الرد")}
                            </button>
                            <button type="button" className="secondary-btn" onClick={() => autoReply(ticket)} disabled={replySendingId === ticket.id || !agentSettings.supportReplyEnabled}>
                              <Bot size={15} />
                              {replySendingId === ticket.id ? tr("Sending...", "جارٍ الإرسال...") : tr("Auto Reply Now", "رد تلقائي الآن")}
                            </button>
                            <button
                              type="button"
                              className="secondary-btn"
                              onClick={() => setReplyDrafts((prev) => {
                                const next = { ...prev };
                                delete next[ticket.id];
                                return next;
                              })}
                            >
                              {tr("Cancel", "إلغاء")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>{tr("Shipping Agent", "إيجنت الشحن")}</h3>
          <span>{tr("Prepare shipment data, then confirm shipping manually or create a Bosta shipment directly.", "جهّز بيانات الشحن، ثم أكّد الشحن يدويًا أو أنشئ شحنة بوسطة مباشرة.")}</span>
        </div>

        <div className="agent-list">
          {shippableOrders.length === 0 ? (
            <p className="empty-note">{tr("No confirmed orders are waiting for shipping.", "لا توجد طلبات مؤكدة بانتظار الشحن.")}</p>
          ) : (
            shippableOrders.map((order) => {
              const draft = shippingDrafts[order.id] || defaultShippingDraft(order, agentSettings);
              return (
                <div key={order.id} className="agent-list-item">
                  <div className="agent-list-head">
                    <div>
                      <strong>{order.orderNumber}</strong>
                      <span>{order.customerName} · {order.customerCity} · {money.format(Number(order.total || 0))}</span>
                    </div>
                    <span className={`status-pill status-${order.status}`}>{order.status}</span>
                  </div>

                  <div className="form-grid">
                    <label>
                      {tr("Shipping Company", "شركة الشحن")}
                      <input value={draft.shippingCompanyName || ""} onChange={(event) => updateShippingDraft(order.id, "shippingCompanyName", event.target.value)} />
                    </label>
                    <label>
                      {tr("Shipping Phone", "هاتف الشحن")}
                      <input value={draft.shippingCompanyPhone || ""} onChange={(event) => updateShippingDraft(order.id, "shippingCompanyPhone", event.target.value)} />
                    </label>
                    <label>
                      {tr("Tracking Number", "رقم التتبع")}
                      <input value={draft.trackingNumber || ""} onChange={(event) => updateShippingDraft(order.id, "trackingNumber", event.target.value)} />
                    </label>
                    <label>
                      {tr("Shipping Status", "حالة الشحن")}
                      <input value={draft.shippingStatus || ""} onChange={(event) => updateShippingDraft(order.id, "shippingStatus", event.target.value)} />
                    </label>
                  </div>

                  <div className="inline-actions">
                    <button type="button" className="secondary-btn" onClick={() => prepareShipping(order)} disabled={shippingLoadingId === order.id || !agentSettings.shippingAgentEnabled}>
                      <Bot size={15} />
                      {shippingLoadingId === order.id ? tr("Preparing...", "جارٍ التجهيز...") : tr("Prepare Shipment", "تجهيز الشحنة")}
                    </button>
                    <button type="button" className="secondary-btn" onClick={() => createBostaShipment(order)} disabled={bostaSavingId === order.id}>
                      <Truck size={15} />
                      {bostaSavingId === order.id ? tr("Creating...", "جارٍ الإنشاء...") : tr("Create With Bosta", "إنشاء عبر بوسطة")}
                    </button>
                    <button type="button" className="primary-btn" onClick={() => confirmShipment(order)} disabled={shippingSavingId === order.id || !agentSettings.shippingAgentEnabled}>
                      <Truck size={15} />
                      {shippingSavingId === order.id ? tr("Confirming...", "جارٍ التأكيد...") : tr("Confirm Shipment", "تأكيد الشحن")}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
