import { useState, useEffect, useMemo, useRef } from "react";
import api from "../lib/api";
import { formatDateTime } from "../utils/format";

export default function WhatsappBotSection({ lang = "en" }) {
  const isArabic = lang === "ar";
  const tr = (en, ar) => (isArabic ? ar : en);

  const [logs, setLogs] = useState([]);
  const [selectedPhone, setSelectedPhone] = useState("");
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  
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
        // Find unique phones and pick the most recent
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

  // Poll for new messages every 5 seconds to catch new checkout orders immediately
  useEffect(() => {
    fetchLogs();
    const interval = setInterval(() => {
      fetchLogs(true);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, selectedPhone]);

  // 2. Group logs by cleaned phone number
  const groupedChats = useMemo(() => {
    const groups = {};
    // Group logs by phone
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
      // Keep track of the most recent message timestamp and content
      if (new Date(log.createdAt) > new Date(groups[key].lastMessageAt)) {
        groups[key].lastMessageAt = log.createdAt;
        groups[key].lastMessageText = log.text;
      }
    });

    // Convert to array and sort by most recent lastMessageAt descending
    return Object.values(groups).sort(
      (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
    );
  }, [logs]);

  // Get messages for the currently selected chat room (sorted oldest to newest for chronological flow)
  const currentChatMessages = useMemo(() => {
    if (!selectedPhone) return [];
    const chat = groupedChats.find(c => c.phone === selectedPhone);
    if (!chat) return [];
    return [...chat.messages].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );
  }, [groupedChats, selectedPhone]);

  // 3. Simulate customer sending reply text
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
        // Reload logs immediately to show the reply and the chatbot's automatic response
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

  return (
    <section className="whatsapp-bot-section" style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "16px", height: "calc(100vh - 120px)", minHeight: "500px" }}>
      {/* Left Sidebar: Active Chats List */}
      <div className="panel" style={{ display: "flex", flexDirection: "column", padding: "16px", overflowY: "auto" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: "1.1rem" }}>{tr("WhatsApp Chats", "محادثات واتساب")}</h3>
        {loading && logs.length === 0 ? (
          <div style={{ padding: "20px", textAlignment: "center" }}>
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

      {/* Right Column: Active Interactive Chat Pane */}
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

            {/* Chat message history bubbles */}
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

            {/* Simulated Customer Actions & Custom Text Input */}
            <div style={{ padding: "16px", borderTop: "1px solid var(--line)", background: "var(--panel)", display: "grid", gap: "12px" }}>
              {/* Quick simulator buttons */}
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

              {/* Text Input Footer */}
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
  );
}
