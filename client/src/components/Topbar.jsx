import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, LogOut, MoonStar, Sun } from "lucide-react";
import { formatDateTime } from "../utils/format";

function getInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "U";
  }

  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
}

function UserAvatar({ name, avatarUrl }) {
  return (
    <span className="avatar-badge" aria-hidden="true">
      {avatarUrl ? <img src={avatarUrl} alt={name || "User avatar"} /> : <span>{getInitials(name)}</span>}
    </span>
  );
}

export default function Topbar({
  user,
  lang = "en",
  theme,
  onToggleLanguage,
  onToggleTheme,
  onLogout,
  notifications = [],
  loading,
}) {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const menuRef = useRef(null);
  const isArabic = lang === "ar";
  const tr = (en, ar) => (isArabic ? ar : en);

  const sortedNotifications = useMemo(
    () =>
      [...notifications].sort(
        (a, b) => new Date(b.createdAt || b.timestamp || 0).getTime() - new Date(a.createdAt || a.timestamp || 0).getTime(),
      ),
    [notifications],
  );

  useEffect(() => {
    function handleOutsideClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsNotificationsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-user">
        <UserAvatar name={user?.name} avatarUrl={user?.avatarUrl} />
        <div className="topbar-user-meta">
          <p className="topbar-title">
            {tr("Welcome", "أهلًا")}، {user?.name}
          </p>
          <p className="topbar-subtitle">
            {user?.role?.toUpperCase() || tr("User", "مستخدم")} · {tr("Last sync", "آخر مزامنة")}:{" "}
            {formatDateTime(new Date())} {loading ? tr("(updating...)", "(جارٍ التحديث...)") : ""}
          </p>
        </div>
      </div>

      <div className="topbar-actions">
        <div className="notif-menu" ref={menuRef}>
          <button
            type="button"
            className={`notif-pill notif-trigger${isNotificationsOpen ? " active" : ""}`}
            onClick={() => setIsNotificationsOpen((prev) => !prev)}
            aria-expanded={isNotificationsOpen}
            aria-haspopup="menu"
          >
            <Bell size={15} />
            <span>{notifications.length}</span>
          </button>

          {isNotificationsOpen ? (
            <div className="notif-menu-card" role="menu">
              <div className="notif-menu-head">
                <strong>{tr("Notifications", "الإشعارات")}</strong>
                <span>{notifications.length}</span>
              </div>
              <div className="notif-menu-list">
                {sortedNotifications.length === 0 ? (
                  <p className="empty-note">{tr("No notifications yet.", "لا توجد إشعارات حاليًا.")}</p>
                ) : (
                  sortedNotifications.slice(0, 10).map((item, index) => (
                    <article
                      key={item.id || item.createdAt || item.timestamp || `${item.message || item.title}-${index}`}
                      className="notif-item"
                    >
                      <strong>{item.title || tr("System update", "تحديث النظام")}</strong>
                      <p>{item.message || item.text || tr("New activity was detected.", "تم رصد نشاط جديد.")}</p>
                      <span>{formatDateTime(item.createdAt || item.timestamp || new Date().toISOString())}</span>
                    </article>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>

        <button type="button" className="icon-btn lang-btn" onClick={onToggleLanguage}>
          {isArabic ? "EN" : "AR"}
        </button>

        <button type="button" className="icon-btn" onClick={onToggleTheme}>
          {theme === "dark" ? <Sun size={16} /> : <MoonStar size={16} />}
        </button>

        <button type="button" className="icon-btn danger" onClick={onLogout}>
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
