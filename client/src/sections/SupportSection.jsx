import { useState } from "react";
import toast from "react-hot-toast";
import { MessageSquare, Send } from "lucide-react";
import { formatDateTime, number } from "../utils/format";

export default function SupportSection({
  tickets = [],
  stats,
  users = [],
  filters,
  onFiltersChange,
  onUpdateTicket,
  onReplyTicket,
  lang = "en",
}) {
  const assignableUsers = users.filter((user) => ["admin", "sales"].includes(user.role));
  const [savingId, setSavingId] = useState("");
  const [replyTicketId, setReplyTicketId] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const isArabic = lang === "ar";
  const tr = (en, ar) => (isArabic ? ar : en);

  async function updateTicket(ticketId, payload) {
    setSavingId(ticketId);
    try {
      await onUpdateTicket(ticketId, payload);
      toast.success(tr("Ticket updated.", "تم تحديث الشكوى."));
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Could not update ticket.", "تعذر تحديث الشكوى."));
    } finally {
      setSavingId("");
    }
  }

  async function sendReply(ticketId) {
    if (!replyMessage.trim()) {
      return;
    }
    setSavingId(ticketId);
    try {
      await onReplyTicket(ticketId, replyMessage);
      setReplyMessage("");
      setReplyTicketId("");
      toast.success(tr("Reply sent.", "تم إرسال الرد."));
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Could not send reply.", "تعذر إرسال الرد."));
    } finally {
      setSavingId("");
    }
  }

  return (
    <div className="section-stack">
      <section className="profit-cards">
        <article>
          <p>{tr("Total Tickets", "إجمالي الشكاوى")}</p>
          <h4>{number.format(stats?.total || 0)}</h4>
        </article>
        <article>
          <p>{tr("Open", "مفتوحة")}</p>
          <h4>{number.format(stats?.open || 0)}</h4>
        </article>
        <article>
          <p>{tr("In Progress", "قيد المتابعة")}</p>
          <h4>{number.format(stats?.inProgress || 0)}</h4>
        </article>
        <article>
          <p>{tr("Resolved", "تم الحل")}</p>
          <h4>{number.format(stats?.resolved || 0)}</h4>
        </article>
      </section>

      <section className="panel">
        <div className="panel-head row-head">
          <div>
            <h3>{tr("Customer Support", "دعم العملاء")}</h3>
            <span>{tr("Manage complaints and chat with customers.", "إدارة الشكاوى والرد على العملاء.")}</span>
          </div>
          <input
            placeholder={tr("Search ticket/customer/order", "ابحث بالشكوى/العميل/الطلب")}
            value={filters.query || ""}
            onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
          />
        </div>

        <div className="filters-grid">
          <label>
            {tr("Status", "الحالة")}
            <select
              value={filters.status || ""}
              onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })}
            >
              <option value="">{tr("All", "الكل")}</option>
              <option value="open">{tr("Open", "مفتوحة")}</option>
              <option value="in_progress">{tr("In Progress", "قيد المتابعة")}</option>
              <option value="resolved">{tr("Resolved", "تم الحل")}</option>
              <option value="closed">{tr("Closed", "مغلقة")}</option>
            </select>
          </label>
        </div>

        <div className="online-orders-grid">
          {tickets.length === 0 ? (
            <article className="online-order-card empty">
              <MessageSquare size={22} />
              <p>{tr("No support tickets found.", "لا توجد شكاوى حالياً.")}</p>
            </article>
          ) : (
            tickets.map((ticket) => (
              <article key={ticket.id} className="online-order-card">
                <div className="online-order-head">
                  <div>
                    <h4>{ticket.subject}</h4>
                    <p>{ticket.customerName} - {ticket.customerEmail || ticket.customerPhone || "-"}</p>
                    <p>{tr("Last update", "آخر تحديث")}: {formatDateTime(ticket.updatedAt)}</p>
                  </div>
                  <span className={`status-pill status-${ticket.status}`}>{ticket.status}</span>
                </div>

                <div className="online-order-meta">
                  <p><strong>{tr("Order", "الطلب")}:</strong> {ticket.orderNumber || "-"}</p>
                  <p><strong>{tr("Assigned", "مُسند إلى")}:</strong> {ticket.assignedToName || tr("Unassigned", "غير مُسند")}</p>
                  <p><strong>{tr("Messages", "الرسائل")}:</strong> {number.format(ticket.messages?.length || 0)}</p>
                </div>

                <div className="form-grid">
                  <label>
                    {tr("Status", "الحالة")}
                    <select
                      value={ticket.status}
                      onChange={(event) =>
                        updateTicket(ticket.id, { status: event.target.value })
                      }
                      disabled={savingId === ticket.id}
                    >
                      <option value="open">{tr("Open", "مفتوحة")}</option>
                      <option value="in_progress">{tr("In Progress", "قيد المتابعة")}</option>
                      <option value="resolved">{tr("Resolved", "تم الحل")}</option>
                      <option value="closed">{tr("Closed", "مغلقة")}</option>
                    </select>
                  </label>

                  <label>
                    {tr("Assign To", "تعيين إلى")}
                    <select
                      value={ticket.assignedToId || ""}
                      onChange={(event) =>
                        updateTicket(ticket.id, { assignedToId: event.target.value })
                      }
                      disabled={savingId === ticket.id}
                    >
                      <option value="">{tr("Unassigned", "غير مُسند")}</option>
                      {assignableUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="support-messages">
                  {(ticket.messages || []).slice(0, 3).map((message) => (
                    <div key={message.id}>
                      <strong>{message.senderName}</strong>
                      <p>{message.body}</p>
                    </div>
                  ))}
                </div>

                <div className="support-reply-row">
                  <input
                    placeholder={tr("Reply message", "اكتب الرد")}
                    value={replyTicketId === ticket.id ? replyMessage : ""}
                    onChange={(event) => {
                      setReplyTicketId(ticket.id);
                      setReplyMessage(event.target.value);
                    }}
                  />
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => sendReply(ticket.id)}
                    disabled={savingId === ticket.id}
                  >
                    <Send size={14} />
                    {tr("Reply", "رد")}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
