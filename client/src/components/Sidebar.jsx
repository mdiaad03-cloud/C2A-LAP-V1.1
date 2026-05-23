import { motion as Motion } from "framer-motion";
import clsx from "clsx";
import { X } from "lucide-react";

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
    <span className="avatar-badge avatar-badge-lg" aria-hidden="true">
      {avatarUrl ? <img src={avatarUrl} alt={name || "User avatar"} /> : <span>{getInitials(name)}</span>}
    </span>
  );
}

export default function Sidebar({ items, activeTab, onSelect, user, lang = "en", isOpen, onClose }) {
  const isArabic = lang === "ar";
  const tr = (en, ar) => (isArabic ? ar : en);

  return (
    <aside className={clsx("sidebar", isOpen && "open")}>
      <div className="sidebar-close-row">
        <button type="button" className="sidebar-close-btn" onClick={onClose} aria-label={tr("Close Menu", "إغلاق القائمة")}>
          <X size={20} />
        </button>
      </div>

      <div className="brand-block">
        <p className="brand-tag">C2A LAP</p>
        <h2>{tr("Sales Management", "إدارة المبيعات")}</h2>

        <div className="sidebar-profile">
          <UserAvatar name={user?.name} avatarUrl={user?.avatarUrl} />
          <div className="sidebar-profile-meta">
            <strong>{user?.name || tr("System User", "مستخدم النظام")}</strong>
            <span>{user?.username || "-"}</span>
          </div>
        </div>

        <span className="brand-role">{user?.role?.toUpperCase()}</span>
      </div>

      <nav className="side-nav">
        {items.map((item, index) => {
          const Icon = item.icon;
          const active = activeTab === item.key;
          return (
            <Motion.button
              key={item.key}
              type="button"
              className={clsx("nav-btn", active && "active")}
              onClick={() => onSelect(item.key)}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <Icon size={17} />
              <span>{item.label}</span>
            </Motion.button>
          );
        })}
      </nav>

      <div className="sidebar-ownership">
        <strong>{tr("C2A LAP Proprietary Platform", "منصة مملوكة لشركة C2A LAP")}</strong>
        <span>
          {tr(
            "Developed by Mohamed Diaa El Deen Samy as a freelance engineer.",
            "تم التطوير بواسطة محمد ضياء الددين سامي كفري لنسر.",
          )}
        </span>
      </div>
    </aside>
  );
}
