import { formatDateTime } from "../utils/format";

export default function LogsSection({ logs, lang = "en" }) {
  const isArabic = lang === "ar";
  const tr = (en, ar) => (isArabic ? ar : en);

  return (
    <section className="panel table-panel">
      <div className="panel-head">
        <h3>{tr("System Activity Logs", "سجلات نشاط النظام")}</h3>
        <span>{tr("Track who changed what and when.", "تتبع من قام بالتعديل ومتى.")}</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{tr("Time", "الوقت")}</th>
              <th>{tr("User", "المستخدم")}</th>
              <th>{tr("Module", "القسم")}</th>
              <th>{tr("Action", "الإجراء")}</th>
              <th>{tr("Details", "التفاصيل")}</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6}>{tr("No logs available.", "لا توجد سجلات حالياً.")}</td>
              </tr>
            ) : (
              logs.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateTime(entry.timestamp)}</td>
                  <td>{entry.username}</td>
                  <td>{entry.module}</td>
                  <td>{entry.action}</td>
                  <td>{entry.details}</td>
                  <td>{entry.ip || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
