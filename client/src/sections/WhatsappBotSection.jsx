import { useState, useEffect, useMemo, useRef } from "react";
import api from "../lib/api";
import toast from "react-hot-toast";
import { formatDateTime } from "../utils/format";
import { MessageSquare, Settings, Save, Info, RefreshCw, HelpCircle } from "lucide-react";

export default function WhatsappBotSection({ lang = "en" }) {
  const isArabic = lang === "ar";
  const tr = (en, ar) => (isArabic ? ar : en);

  const [subTab, setSubTab] = useState("simulator"); // "simulator" or "templates"
  const [logs, setLogs] = useState([]);
  const [selectedPhone, setSelectedPhone] = useState("");
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Templates state
  const [templates, setTemplates] = useState({});
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("order_confirmation");
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [savingTemplates, setSavingTemplates] = useState(false);

  const messagesEndRef = useRef(null);

  // 1. Fetch WhatsApp message logs from backend
  async function fetchLogs(silent = false) {
    if (!silent) setLoading(true);
    try {
      const response = await api.get("/whatsapp/logs");
      const fetchedLogs = response.data?.logs || [];
      setLogs(fetchedLogs);

      // Auto-select the first phone if none is selected
      if (fetchedLogs.length > 0 && !selectedPhone) {
        const uniquePhones = [...new Set(fetchedLogs.map(l => l.phone))];
        if (uniquePhones.length > 0) {
          setSelectedPhone(uniquePhones[0]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch WhatsApp logs:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  // 2. Fetch templates from backend
  async function fetchTemplates() {
    setLoadingTemplates(true);
    try {
      const response = await api.get("/whatsapp/templates");
      setTemplates(response.data?.templates || {});
    } catch (error) {
      toast.error(tr("Failed to load templates.", "تعذر تحميل قوالب الرسائل."));
      console.error("Failed to fetch templates:", error);
    } finally {
      setLoadingTemplates(false);
    }
  }

  // Save templates
  async function handleSaveTemplates() {
    setSavingTemplates(true);
    try {
      const response = await api.post("/whatsapp/templates", { templates });
      if (response.data?.success) {
        toast.success(tr("Templates saved successfully!", "تم حفظ قوالب الرسائل بنجاح!"));
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Failed to save templates.", "تعذر حفظ قوالب الرسائل."));
    } finally {
      setSavingTemplates(false);
    }
  }

  // Poll for new messages every 5 seconds in simulator tab
  useEffect(() => {
    if (subTab === "simulator") {
      fetchLogs();
      const interval = setInterval(() => {
        fetchLogs(true);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [subTab]);

  // Fetch templates when entering the templates tab
  useEffect(() => {
    if (subTab === "templates") {
      void fetchTemplates();
    }
  }, [subTab]);

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, selectedPhone, subTab]);

  // Group logs by cleaned phone number
  const groupedChats = useMemo(() => {
    const groups = {};
    logs.forEach((log) => {
      const key = log.phone || "unknown";
      if (!groups[key]) {
        groups[key] = {
          phone: key,
          rawPhone: log.rawPhone || key,
          messages: [],
          lastMessageAt: log.createdAt,
          lastMessageText: log.text,
        };
      }
      groups[key].messages.push(log);
      if (new Date(log.createdAt) > new Date(groups[key].lastMessageAt)) {
        groups[key].lastMessageAt = log.createdAt;
        groups[key].lastMessageText = log.text;
      }
    });

    return Object.values(groups).sort(
      (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
    );
  }, [logs]);

  // Get messages for current chat
  const currentChatMessages = useMemo(() => {
    if (!selectedPhone) return [];
    const chat = groupedChats.find(c => c.phone === selectedPhone);
    if (!chat) return [];
    return [...chat.messages].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );
  }, [groupedChats, selectedPhone]);

  // Simulate customer sending reply text
  async function handleSimulateSend(textToSend) {
    const text = String(textToSend || inputText).trim();
    if (!text || !selectedPhone || sending) return;

    setSending(true);
    try {
      const response = await api.post("/whatsapp/simulate-reply", {
        phone: selectedPhone,
        text: text,
      });

      if (response.data?.success) {
        setInputText("");
        await fetchLogs(true);
      }
    } catch (error) {
      console.error("Simulation reply failed:", error);
    } finally {
      setSending(false);
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSimulateSend();
    }
  };

  const templateLabel = (key) => {
    return ({
      order_confirmation: tr("Order Confirmation (COD)", "تأكيد الطلب (الدفع عند الاستلام)"),
      order_confirmed: tr("Order Confirmed", "تأكيد الطلب من الإدارة"),
      order_shipped: tr("Order Shipped", "شحن الطلب"),
      order_delivered: tr("Order Delivered", "تم توصيل الطلب"),
      order_cancelled: tr("Order Cancelled", "إلغاء الطلب"),
    })[key] || key;
  };

  const templateDescription = (key) => {
    return ({
      order_confirmation: tr("Sent immediately when a COD order is placed to let the customer confirm (1) or cancel (2).", "تُرسل فوراً عند قيام العميل بعمل طلب دفع عند الاستلام ليقوم بتأكيد الطلب برقم (1) أو إلغائه برقم (2)."),
      order_confirmed: tr("Sent when the order is confirmed by the admin or automatically via Paymob payment.", "تُرسل عندما يتم تأكيد الطلب من قبل الإدارة، أو تلقائياً بعد نجاح الدفع عبر Paymob."),
      order_shipped: tr("Sent when the order is shipped to the customer, displaying carrier and tracking number.", "تُرسل عند شحن الطلب وتعبئة بيانات شركة الشحن ورقم التتبع."),
      order_delivered: tr("Sent when Bosta or webhook confirms the order has been delivered successfully.", "تُرسل عند تسليم الشحنة للعميل بنجاح وتحديث حالتها في النظام."),
      order_cancelled: tr("Sent when the order is cancelled by the admin or customer.", "تُرسل عند إلغاء الطلب من قبل العميل أو الإدارة."),
    })[key] || "";
  };

  const placeholders = [
    { tag: "{customerName}", label: tr("Customer Name", "اسم العميل") },
    { tag: "{orderNumber}", label: tr("Order Number", "رقم الطلب") },
    { tag: "{paymentLabel}", label: tr("Payment Method Status", "طريقة وحالة الدفع") },
    { tag: "{itemsList}", label: tr("Items list of the order", "قائمة المنتجات والكميات") },
    { tag: "{total}", label: tr("Order Total Amount (EGP)", "المبلغ الإجمالي بالجنيه") },
    { tag: "{carrierLine}", label: tr("Carrier line (Optional)", "اسم شركة الشحن (اختياري)") },
    { tag: "{trackingLine}", label: tr("Tracking Number (Optional)", "رقم التتبع (اختياري)") },
    { tag: "{trackingUrlLine}", label: tr("Tracking URL (Optional)", "رابط تتبع الشحنة (اختياري)") },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", minHeight: "550px", gap: "12px" }}>
      {/* Subtab Navigation Bar */}
      <div style={{ display: "flex", gap: "10px", borderBottom: "1px solid var(--line)", paddingBottom: "8px", flexShrink: 0 }}>
        <button
          type="button"
          className={subTab === "simulator" ? "primary-btn" : "secondary-btn"}
          onClick={() => setSubTab("simulator")}
          style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 16px" }}
        >
          <MessageSquare size={16} />
          <span>{tr("Chat Simulator", "محاكي الدردشة التفاعلي")}</span>
        </button>
        <button
          type="button"
          className={subTab === "templates" ? "primary-btn" : "secondary-btn"}
          onClick={() => setSubTab("templates")}
          style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 16px" }}
        >
          <Settings size={16} />
          <span>{tr("Customer Messages Templates", "تعديل قوالب رسائل العملاء")}</span>
        </button>
      </div>

      {/* Simulator view */}
      {subTab === "simulator" && (
        <section className="whatsapp-bot-section" style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "16px", flex: 1, overflow: "hidden" }}>
          {/* Left Sidebar: Active Chats */}
          <div className="panel" style={{ display: "flex", flexDirection: "column", padding: "16px", overflowY: "auto", height: "100%" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: "1.1rem" }}>{tr("WhatsApp Chats", "محادثات واتساب")}</h3>
            {loading && logs.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center" }}>
                <div className="store-loading-spinner" style={{ margin: "0 auto 8px" }} />
                <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{tr("Loading chats...", "جاري تحميل المحادثات...")}</p>
              </div>
            ) : groupedChats.length === 0 ? (
              <div style={{ color: "var(--muted)", textAlign: "center", padding: "20px", fontSize: "0.9rem" }}>
                {tr("No active WhatsApp simulator logs.", "لا توجد محادثات واتساب نشطة حالياً.")}
              </div>
            ) : (
              <div style={{ display: "grid", gap: "8px" }}>
                {groupedChats.map((chat) => (
                  <button
                    key={chat.phone}
                    onClick={() => setSelectedPhone(chat.phone)}
                    style={{
                      textAlign: "left",
                      padding: "12px",
                      borderRadius: "10px",
                      border: "1px solid",
                      borderColor: selectedPhone === chat.phone ? "var(--primary)" : "var(--line)",
                      background: selectedPhone === chat.phone ? "var(--primary-subtle)" : "var(--panel)",
                      cursor: "pointer",
                      display: "grid",
                      gap: "4px",
                      width: "100%",
                      transition: "all 0.2s"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "0.9rem", color: "var(--text)" }}>
                      <span>{chat.rawPhone}</span>
                      <span style={{ fontSize: "0.75rem", fontWeight: "normal", color: "var(--muted)" }}>
                        {formatDateTime(chat.lastMessageAt).split(" ")[1] || ""}
                      </span>
                    </div>
                    <p style={{
                      margin: 0,
                      fontSize: "0.8rem",
                      color: "var(--muted)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      textAlign: isArabic ? "right" : "left",
                      direction: isArabic ? "rtl" : "ltr"
                    }}>
                      {chat.lastMessageText}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Chat simulator pane */}
          <div className="panel" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", padding: 0 }}>
            {selectedPhone ? (
              <>
                {/* Chat header */}
                <div style={{ padding: "16px", borderBottom: "1px solid var(--line)", background: "var(--panel)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: "1.05rem" }}>
                      {tr("Chat Simulator with: ", "محاكاة المحادثة مع: ")}
                      <strong>{selectedPhone}</strong>
                    </h4>
                    <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{tr("Simulate customer responses in real time", "محاكاة ردود العميل في الوقت الفعلي")}</span>
                  </div>
                  <button onClick={() => fetchLogs()} className="btn btn-secondary btn-sm" style={{ padding: "4px 8px" }}>
                    {tr("Refresh", "تحديث")}
                  </button>
                </div>

                {/* Chat message bubbles */}
                <div style={{ flex: 1, padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", background: "var(--panel-bg, #fafafa)" }}>
                  {currentChatMessages.map((msg) => {
                    const isOutgoing = msg.direction === "outgoing";
                    return (
                      <div
                        key={msg.id}
                        style={{
                          alignSelf: isOutgoing ? "flex-start" : "flex-end",
                          maxWidth: "75%",
                          display: "grid",
                          gap: "4px"
                        }}
                      >
                        <div
                          style={{
                            padding: "10px 14px",
                            borderRadius: "14px",
                            borderTopLeftRadius: isOutgoing ? "2px" : "14px",
                            borderTopRightRadius: isOutgoing ? "14px" : "2px",
                            background: isOutgoing ? "#e2f0d9" : "#0f766e",
                            color: isOutgoing ? "#1e3e0f" : "#ffffff",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                            fontSize: "0.9rem",
                            whiteSpace: "pre-wrap",
                            lineHeight: 1.5,
                            textAlign: "right",
                            direction: "rtl"
                          }}
                        >
                          {msg.text}
                        </div>
                        <span style={{ fontSize: "0.7rem", color: "var(--muted)", alignSelf: isOutgoing ? "flex-start" : "flex-end" }}>
                          {formatDateTime(msg.createdAt)}
                        </span>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Simulated replies console */}
                <div style={{ padding: "16px", borderTop: "1px solid var(--line)", background: "var(--panel)", display: "grid", gap: "12px" }}>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: "bold", color: "var(--muted)" }}>
                      {tr("Simulate customer replies:", "محاكاة ردود العميل السريعة:")}
                    </span>
                    <button
                      onClick={() => handleSimulateSend("1")}
                      className="btn btn-secondary btn-sm"
                      style={{ background: "#d1e7dd", color: "#0f5132", borderColor: "#badbcc", fontSize: "0.8rem" }}
                      disabled={sending}
                    >
                      {tr('Send "1" (Confirm)', 'إرسال "1" (تأكيد)')}
                    </button>
                    <button
                      onClick={() => handleSimulateSend("تأكيد")}
                      className="btn btn-secondary btn-sm"
                      style={{ background: "#d1e7dd", color: "#0f5132", borderColor: "#badbcc", fontSize: "0.8rem" }}
                      disabled={sending}
                    >
                      {tr('Send "تأكيد"', 'إرسال "تأكيد"')}
                    </button>
                    <button
                      onClick={() => handleSimulateSend("2")}
                      className="btn btn-secondary btn-sm"
                      style={{ background: "#f8d7da", color: "#842029", borderColor: "#f5c2c7", fontSize: "0.8rem" }}
                      disabled={sending}
                    >
                      {tr('Send "2" (Cancel)', 'إرسال "2" (إلغاء)')}
                    </button>
                    <button
                      onClick={() => handleSimulateSend("إلغاء")}
                      className="btn btn-secondary btn-sm"
                      style={{ background: "#f8d7da", color: "#842029", borderColor: "#f5c2c7", fontSize: "0.8rem" }}
                      disabled={sending}
                    >
                      {tr('Send "إلغاء"', 'إرسال "إلغاء"')}
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      placeholder={tr("Type a simulated customer message...", "اكتب رسالة محاكاة للعميل...")}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={handleKeyPress}
                      disabled={sending}
                      style={{
                        flex: 1,
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid var(--line)",
                        background: "var(--input-bg)",
                        color: "var(--text)",
                        outline: "none"
                      }}
                    />
                    <button
                      onClick={() => handleSimulateSend()}
                      className="btn btn-primary"
                      style={{ padding: "0 20px" }}
                      disabled={!inputText.trim() || sending}
                    >
                      {sending ? tr("Sending...", "جاري الإرسال...") : tr("Send", "إرسال")}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--muted)", fontSize: "0.95rem" }}>
                {tr("Select a WhatsApp chat to view conversation and simulate replies.", "اختر محادثة واتساب لعرض الرسائل ومحاكاة الردود.")}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Templates view */}
      {subTab === "templates" && (
        <section className="whatsapp-templates-section" style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "16px", flex: 1, overflow: "hidden" }}>
          {/* Left panel: List of template types */}
          <div className="panel" style={{ display: "flex", flexDirection: "column", padding: "16px", overflowY: "auto", height: "100%" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: "1.1rem" }}>{tr("Select Template", "اختر قالب الرسالة")}</h3>
            {loadingTemplates ? (
              <div style={{ padding: "20px", textAlign: "center" }}>
                <div className="store-loading-spinner" style={{ margin: "0 auto 8px" }} />
                <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{tr("Loading templates...", "جاري تحميل القوالب...")}</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "8px" }}>
                {["order_confirmation", "order_confirmed", "order_shipped", "order_delivered", "order_cancelled"].map((key) => (
                  <button
                    key={key}
                    onClick={() => setSelectedTemplateKey(key)}
                    style={{
                      textAlign: isArabic ? "right" : "left",
                      padding: "12px",
                      borderRadius: "10px",
                      border: "1px solid",
                      borderColor: selectedTemplateKey === key ? "var(--primary)" : "var(--line)",
                      background: selectedTemplateKey === key ? "var(--primary-subtle)" : "var(--panel)",
                      cursor: "pointer",
                      display: "grid",
                      gap: "4px",
                      width: "100%",
                      transition: "all 0.2s"
                    }}
                  >
                    <strong style={{ fontSize: "0.9rem", color: "var(--text)" }}>{templateLabel(key)}</strong>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {templateDescription(key)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right panel: Live editor & explanation */}
          <div className="panel" style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", padding: "20px", gap: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "1.2rem", color: "var(--primary)" }}>{templateLabel(selectedTemplateKey)}</h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>{templateDescription(selectedTemplateKey)}</p>
              </div>
              <button
                type="button"
                className="primary-btn"
                onClick={handleSaveTemplates}
                disabled={savingTemplates || loadingTemplates}
                style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
              >
                <Save size={16} />
                <span>{savingTemplates ? tr("Saving...", "جاري الحفظ...") : tr("Save Templates", "حفظ القوالب")}</span>
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "20px", flex: 1 }}>
              {/* Textarea Editor */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontWeight: "bold", fontSize: "0.95rem", display: "flex", justifyContent: "space-between" }}>
                  <span>{tr("Message Content", "محتوى قالب الرسالة:")}</span>
                  <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: "normal" }}>
                    {tr("Supports WhatsApp formatting (*bold*, _italic_)", "يدعم تنسيقات واتساب (*عريض*، _مائل_)")}
                  </span>
                </label>
                <textarea
                  value={templates[selectedTemplateKey] || ""}
                  onChange={(e) => setTemplates(prev => ({ ...prev, [selectedTemplateKey]: e.target.value }))}
                  placeholder={tr("Write WhatsApp message body here...", "اكتب نص قالب الرسالة هنا...")}
                  disabled={loadingTemplates || savingTemplates}
                  style={{
                    flex: 1,
                    minHeight: "320px",
                    padding: "16px",
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                    background: "var(--input-bg)",
                    color: "var(--text)",
                    fontFamily: "monospace",
                    fontSize: "0.95rem",
                    lineHeight: 1.5,
                    resize: "none",
                    outline: "none"
                  }}
                />
              </div>

              {/* Variables Panel */}
              <div className="panel" style={{ background: "color-mix(in srgb, var(--surface) 96%, transparent)", padding: "16px", display: "flex", flexDirection: "column", gap: "12px", border: "1px solid var(--line)" }}>
                <h4 style={{ margin: 0, fontSize: "0.9rem", display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--primary)" }}>
                  <Info size={14} />
                  <span>{tr("Placeholders Guide", "دليل المتغيرات")}</span>
                </h4>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)", lineHeight: 1.4 }}>
                  {tr("Copy and paste these tags into the template. The server will dynamically replace them with active order details upon sending.", "قم بنسخ ولصق هذه المتغيرات داخل نص الرسالة ليقوم السيرفر باستبدالها تلقائياً ببيانات الطلب عند الإرسال.")}
                </p>
                <div style={{ display: "grid", gap: "8px", fontSize: "0.8rem" }}>
                  {placeholders.map(p => (
                    <div
                      key={p.tag}
                      onClick={() => {
                        // Click to copy variable
                        navigator.clipboard.writeText(p.tag);
                        toast.success(tr(`Copied ${p.tag}`, `تم نسخ ${p.tag}`));
                      }}
                      style={{
                        padding: "8px",
                        background: "var(--panel)",
                        border: "1px solid var(--line)",
                        borderRadius: "6px",
                        cursor: "pointer",
                        display: "grid",
                        gap: "2px",
                        transition: "all 0.2s"
                      }}
                      title={tr("Click to copy tag", "انقر لنسخ المتغير")}
                    >
                      <code style={{ color: "var(--primary)", fontWeight: "bold", fontSize: "0.85rem" }}>{p.tag}</code>
                      <span style={{ color: "var(--muted)" }}>{p.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
