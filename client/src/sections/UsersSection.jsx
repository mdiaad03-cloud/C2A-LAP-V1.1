import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Pencil, Trash2, Upload, UserPlus, X } from "lucide-react";
import { formatDateTime } from "../utils/format";

const blank = {
  name: "",
  username: "",
  password: "",
  role: "sales",
  avatarUrl: "",
  isActive: true,
};

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

function roleLabel(role, tr) {
  switch (String(role || "").toLowerCase()) {
    case "admin":
      return tr("Admin", "إدارة");
    case "sales":
      return tr("Sales", "مبيعات");
    case "products":
      return tr("Products Only", "منتجات فقط");
    case "customer":
      return tr("Customer", "عميل");
    default:
      return role || "-";
  }
}

function UserAvatar({ name, avatarUrl }) {
  return (
    <span className="avatar-badge user-avatar-mini" aria-hidden="true">
      {avatarUrl ? <img src={avatarUrl} alt={name || "User avatar"} /> : <span>{getInitials(name)}</span>}
    </span>
  );
}

export default function UsersSection({
  users,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
  onUploadAvatar,
  lang = "en",
}) {
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const isArabic = lang === "ar";
  const tr = (en, ar) => (isArabic ? ar : en);

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))),
    [users],
  );

  function update(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function startEdit(user) {
    setEditingId(user.id);
    setForm({
      name: user.name || "",
      username: user.username || "",
      password: "",
      role: user.role || "sales",
      avatarUrl: user.avatarUrl || "",
      isActive: Boolean(user.isActive),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId("");
    setForm(blank);
  }

  async function handleAvatarFile(event) {
    const file = event.target.files?.[0];
    if (!file || uploadingAvatar) {
      return;
    }

    setUploadingAvatar(true);
    try {
      const avatarUrl = await onUploadAvatar(file);
      setForm((prev) => ({ ...prev, avatarUrl }));
      toast.success(tr("Avatar uploaded.", "تم رفع الصورة."));
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Could not upload avatar.", "تعذر رفع الصورة."));
    } finally {
      setUploadingAvatar(false);
      event.target.value = "";
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) {
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await onUpdateUser(editingId, {
          name: form.name,
          role: form.role,
          avatarUrl: form.avatarUrl,
          isActive: form.isActive,
          ...(form.password ? { password: form.password } : {}),
        });
        toast.success(tr("User updated.", "تم تحديث المستخدم."));
      } else {
        await onCreateUser(form);
        toast.success(tr("User created.", "تم إنشاء المستخدم."));
      }
      setForm(blank);
      setEditingId("");
    } catch (error) {
      toast.error(
        error?.response?.data?.error
          || tr(
            editingId ? "Could not update user." : "Could not create user.",
            editingId ? "تعذر تحديث المستخدم." : "تعذر إنشاء المستخدم.",
          ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user) {
    if (!user?.id || deletingId) {
      return;
    }
    const confirmed = window.confirm(
      tr(`Delete account ${user.username}?`, `حذف الحساب ${user.username}؟`),
    );
    if (!confirmed) {
      return;
    }

    setDeletingId(user.id);
    try {
      await onDeleteUser(user.id);
      if (editingId === user.id) {
        cancelEdit();
      }
      toast.success(tr("User deleted.", "تم حذف المستخدم."));
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Could not delete user.", "تعذر حذف المستخدم."));
    } finally {
      setDeletingId("");
    }
  }

  return (
    <div className="section-stack">
      <section className="panel form-panel">
        <div className="panel-head">
          <h3>{editingId ? tr("Edit User", "تعديل المستخدم") : tr("User Management", "إدارة المستخدمين")}</h3>
          <span>
            {tr(
              "Create internal accounts, upload avatar images, and control access status.",
              "أنشئ حسابات داخلية، وارفع صور المستخدمين، وتحكم في حالة الوصول.",
            )}
          </span>
        </div>

        <form className="form-grid" onSubmit={submit}>
          <label>
            {tr("Full Name", "الاسم الكامل")}
            <input value={form.name} onChange={(event) => update("name", event.target.value)} required />
          </label>
          <label>
            {tr("Username", "اسم المستخدم")}
            <input
              value={form.username}
              onChange={(event) => update("username", event.target.value)}
              required
              disabled={Boolean(editingId)}
            />
          </label>
          <label>
            {tr(editingId ? "New Password" : "Password", editingId ? "كلمة مرور جديدة" : "كلمة المرور")}
            <input
              type="password"
              value={form.password}
              onChange={(event) => update("password", event.target.value)}
              required={!editingId}
              placeholder={editingId ? tr("Leave blank to keep current password", "اتركها فارغة للإبقاء على الحالية") : ""}
            />
          </label>
          <label>
            {tr("Role", "الدور")}
            <select value={form.role} onChange={(event) => update("role", event.target.value)}>
              <option value="sales">{tr("Sales", "مبيعات")}</option>
              <option value="products">{tr("Products Only", "منتجات فقط")}</option>
              <option value="admin">{tr("Admin", "إدارة")}</option>
            </select>
          </label>

          <div className="span-2 avatar-upload-block">
            <div className="user-form-preview">
              <UserAvatar name={form.name || form.username} avatarUrl={form.avatarUrl} />
              <div>
                <strong>{form.name || tr("Preview", "معاينة")}</strong>
                <p>{form.username || tr("Username will appear here", "سيظهر اسم المستخدم هنا")}</p>
              </div>
            </div>

            <div className="inline-actions">
              <label className="upload-btn">
                <Upload size={16} />
                {uploadingAvatar ? tr("Uploading image...", "جارٍ رفع الصورة...") : tr("Upload Avatar", "رفع صورة")}
                <input type="file" accept="image/*" hidden onChange={handleAvatarFile} />
              </label>
              {form.avatarUrl ? (
                <button type="button" className="secondary-btn" onClick={() => update("avatarUrl", "")}>
                  <X size={16} />
                  {tr("Remove Avatar", "حذف الصورة")}
                </button>
              ) : null}
            </div>
          </div>

          <label className="checkbox-field span-2">
            <input
              type="checkbox"
              checked={Boolean(form.isActive)}
              onChange={(event) => update("isActive", event.target.checked)}
            />
            {tr("Account is active", "الحساب نشط")}
          </label>

          <button type="submit" className="primary-btn span-2" disabled={saving}>
            <UserPlus size={16} />
            {saving
              ? tr("Saving...", "جارٍ الحفظ...")
              : editingId
                ? tr("Save Changes", "حفظ التعديلات")
                : tr("Create User", "إنشاء مستخدم")}
          </button>
          {editingId ? (
            <button type="button" className="secondary-btn span-2" onClick={cancelEdit}>
              {tr("Cancel Edit", "إلغاء التعديل")}
            </button>
          ) : null}
        </form>
      </section>

      <section className="panel table-panel">
        <div className="panel-head">
          <h3>{tr("System Users", "مستخدمو النظام")}</h3>
          <span>{tr("Delete accounts, review roles, and check latest activity.", "احذف الحسابات، وراجع الأدوار، وتابع آخر نشاط.")}</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{tr("User", "المستخدم")}</th>
                <th>{tr("Username", "اسم المستخدم")}</th>
                <th>{tr("Role", "الدور")}</th>
                <th>{tr("Status", "الحالة")}</th>
                <th>{tr("Last Login", "آخر تسجيل دخول")}</th>
                <th>{tr("Actions", "الإجراءات")}</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="user-cell">
                      <UserAvatar name={user.name} avatarUrl={user.avatarUrl} />
                      <div className="user-cell-meta">
                        <strong>{user.name}</strong>
                        <span>{user.email || user.username}</span>
                      </div>
                    </div>
                  </td>
                  <td>{user.username}</td>
                  <td>{roleLabel(user.role, tr)}</td>
                  <td>{user.isActive ? tr("Active", "نشط") : tr("Disabled", "معطل")}</td>
                  <td>{formatDateTime(user.lastLoginAt)}</td>
                  <td>
                    <div className="table-actions">
                      <button type="button" className="secondary-btn" onClick={() => startEdit(user)}>
                        <Pencil size={14} />
                        {tr("Edit", "تعديل")}
                      </button>
                      <button
                        type="button"
                        className="secondary-btn danger-outline"
                        onClick={() => handleDelete(user)}
                        disabled={deletingId === user.id}
                      >
                        <Trash2 size={14} />
                        {deletingId === user.id ? tr("Deleting...", "جارٍ الحذف...") : tr("Delete", "حذف")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
