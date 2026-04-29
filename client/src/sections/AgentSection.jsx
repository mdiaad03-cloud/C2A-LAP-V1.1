import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Bot, PackagePlus, Send, Truck } from "lucide-react";
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
  autoMoveTicketsToInProgress: true,
  defaultShippingCompanyName: "C2A LAP Delivery",
  defaultShippingStatus: "in_transit",
  productDescriptionTone: "professional",
  supportReplyTone: "friendly",
};

function latestMessage(ticket) {
  return Array.isArray(ticket?.messages) && ticket.messages.length > 0 ? ticket.messages[0]?.body || "" : "";
}

function defaultShippingDraft(order, settings = defaultAgentSettings) {
  return {
    shippingCompanyName: order.shippingCompanyName || settings.defaultShippingCompanyName || "",
    shippingCompanyPhone: order.shippingCompanyPhone || "",
    trackingNumber: order.trackingNumber || "",
    shippingStatus: order.shippingStatus || settings.defaultShippingStatus || "in_transit",
  };
}

export default function AgentSection({
  tickets = [],
  orders = [],
  onGenerateProductDraft,
  onCreateProduct,
  onUploadProductImages,
  onGenerateSupportReply,
  onReplyTicket,
  onUpdateTicket,
  onUpdateOrder,
  onGenerateShippingDraft,
  settings,
  lang = "en",
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
  const [productSaving, setProductSaving] = useState(false);
  const [productGenerating, setProductGenerating] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);

  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyLoadingId, setReplyLoadingId] = useState("");
  const [replySendingId, setReplySendingId] = useState("");

  const [shippingDrafts, setShippingDrafts] = useState({});
  const [shippingLoadingId, setShippingLoadingId] = useState("");
  const [shippingSavingId, setShippingSavingId] = useState("");

  const actionableTickets = useMemo(
    () => tickets.filter((ticket) => ["open", "in_progress"].includes(ticket.status)).slice(0, 8),
    [tickets],
  );

  const shippableOrders = useMemo(
    () => orders.filter((order) => order.status === "confirmed").slice(0, 8),
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
      toast.success(tr("Agent created the product successfully.", "تمت إضافة المنتج عبر الإيجنت بنجاح."));
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
      toast.success(tr("Shipping confirmation draft is ready.", "مسودة تأكيد الشحن جاهزة."));
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
      toast.success(tr("Shipment confirmed and customer can be notified.", "تم تأكيد الشحن ويمكن إخطار العميل."));
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Could not confirm shipment.", "تعذر تأكيد الشحن."));
    } finally {
      setShippingSavingId("");
    }
  }

  return (
    <div className="section-stack">
      <section className="panel">
        <div className="panel-head">
          <h3>{tr("Operations Agent", "وكيل العمليات")}</h3>
          <span>
            {tr(
              "One workspace to draft products, reply to customers, and move confirmed orders into shipping.",
              "مساحة واحدة لتجهيز المنتجات، والرد على العملاء، وتحويل الطلبات المؤكدة إلى الشحن.",
            )}
          </span>
        </div>

        <div className="agent-suggestion-box">
          <div className="agent-suggestion-head">
            <strong>{tr("Current Settings", "الإعدادات الحالية")}</strong>
            <span>{tr("Managed from Store Settings > Agent Settings.", "يمكن التحكم فيها من إعدادات المتجر > إعدادات الإيجنت.")}</span>
          </div>
          <div className="agent-settings-summary">
            <span className={`status-pill ${agentSettings.productDraftEnabled ? "status-confirmed" : "status-cancelled"}`}>
              {tr("Products", "المنتجات")}: {agentSettings.productDraftEnabled ? tr("On", "مفعل") : tr("Off", "متوقف")}
            </span>
            <span className={`status-pill ${agentSettings.supportReplyEnabled ? "status-confirmed" : "status-cancelled"}`}>
              {tr("Support", "الدعم")}: {agentSettings.supportReplyEnabled ? tr("On", "مفعل") : tr("Off", "متوقف")}
            </span>
            <span className={`status-pill ${agentSettings.shippingAgentEnabled ? "status-confirmed" : "status-cancelled"}`}>
              {tr("Shipping", "الشحن")}: {agentSettings.shippingAgentEnabled ? tr("On", "مفعل") : tr("Off", "متوقف")}
            </span>
            <span className="status-pill status-pending">
              {tr("Shipping Company", "شركة الشحن")}: {agentSettings.defaultShippingCompanyName}
            </span>
          </div>
        </div>

        <div className="agent-grid">
          <article className="agent-card">
            <div className="agent-card-head">
              <div>
                <h4>{tr("Product Agent", "وكيل المنتجات")}</h4>
                <p>
                  {tr(
                    "Generate a ready product draft from raw specs, then save it with images.",
                    "ولّد مسودة منتج جاهزة من المواصفات، ثم احفظها مع الصور.",
                  )}
                </p>
              </div>
              <span className="agent-icon-badge">
                <PackagePlus size={18} />
              </span>
            </div>

            {!agentSettings.productDraftEnabled ? (
              <p className="empty-note">{tr("Product agent is currently disabled from settings.", "وكيل المنتجات متوقف حاليًا من الإعدادات.")}</p>
            ) : null}

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
                {tr("Display", "الشاشة")}
                <input value={productInput.display} onChange={(event) => updateProductInput("display", event.target.value)} />
              </label>
              <label>
                OS
                <input value={productInput.os} onChange={(event) => updateProductInput("os", event.target.value)} />
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
              <label className="span-2">
                {tr("Upload Images From Device", "رفع الصور من الجهاز")}
                <input type="file" accept="image/*" multiple onChange={(event) => setSelectedImages(Array.from(event.target.files || []))} />
                <small>
                  {selectedImages.length > 0
                    ? tr(`${selectedImages.length} image(s) selected.`, `تم اختيار ${selectedImages.length} صورة.`)
                    : tr("You can still upload local images before saving the product.", "يمكنك أيضًا رفع صور من الجهاز قبل حفظ المنتج.")}
                </small>
              </label>

              <button type="submit" className="primary-btn span-2" disabled={productGenerating || !agentSettings.productDraftEnabled}>
                <Bot size={16} />
                {productGenerating ? tr("Generating...", "جارٍ التوليد...") : tr("Generate Draft", "توليد المسودة")}
              </button>
            </form>

            {productDraft ? (
              <div className="agent-suggestion-box">
                <div className="agent-suggestion-head">
                  <strong>{tr("Agent Draft", "مسودة الإيجنت")}</strong>
                  <span>{tr("You can edit before saving.", "يمكنك التعديل قبل الحفظ.")}</span>
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
                    {tr("Shipping Info", "بيانات الشحن")}
                    <input value={productDraft.shippingInfo || ""} onChange={(event) => updateProductDraft("shippingInfo", event.target.value)} />
                  </label>
                  <label className="span-2">
                    {tr("Shipping Info (AR)", "بيانات الشحن بالعربي")}
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
                <h4>{tr("Support Agent", "وكيل الدعم")}</h4>
                <p>
                  {tr(
                    "Generate customer replies from ticket context, then send them with one review step.",
                    "ولّد ردودًا على العملاء من سياق الشكوى، ثم أرسلها بعد مراجعة سريعة.",
                  )}
                </p>
              </div>
              <span className="agent-icon-badge">
                <Send size={18} />
              </span>
            </div>

            <div className="agent-list">
              {!agentSettings.supportReplyEnabled ? (
                <p className="empty-note">{tr("Support agent is currently disabled from settings.", "وكيل الدعم متوقف حاليًا من الإعدادات.")}</p>
              ) : actionableTickets.length === 0 ? (
                <p className="empty-note">{tr("No open tickets waiting for the agent.", "لا توجد شكاوى مفتوحة بانتظار الإيجنت.")}</p>
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
          <h3>{tr("Shipping Agent", "وكيل الشحن")}</h3>
          <span>{tr("Move confirmed online orders into shipped status with ready shipping fields.", "حوّل الطلبات المؤكدة إلى تم الشحن مع تجهيز حقول الشحن مباشرة.")}</span>
        </div>

        <div className="agent-list">
          {!agentSettings.shippingAgentEnabled ? (
            <p className="empty-note">{tr("Shipping agent is currently disabled from settings.", "وكيل الشحن متوقف حاليًا من الإعدادات.")}</p>
          ) : shippableOrders.length === 0 ? (
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
