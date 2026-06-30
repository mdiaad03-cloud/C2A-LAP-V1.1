import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Pencil, Trash2, Upload, UserPlus, X, Coins, Eye, EyeOff, Landmark, History, Plus } from "lucide-react";
import { formatDateTime, money } from "../utils/format";

const blank = {
  name: "",
  username: "",
  password: "",
  role: "sales",
  avatarUrl: "",
  isActive: true,
  cashNumber: "",
  instapayAddress: "",
  canViewOnlineOrders: true,
  payoutAmount: "",
  payoutNotes: "",
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

  const selectedUser = useMemo(() => {
    return users.find((u) => u.id === editingId) || null;
  }, [users, editingId]);

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
      cashNumber: user.cashNumber || "",
      instapayAddress: user.instapayAddress || "",
      canViewOnlineOrders: user.canViewOnlineOrders !== false,
      payoutAmount: "",
      payoutNotes: "",
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
          cashNumber: form.cashNumber,
          instapayAddress: form.instapayAddress,
          canViewOnlineOrders: form.canViewOnlineOrders,
          payoutAmount: form.payoutAmount ? Number(form.payoutAmount) : undefined,
          payoutNotes: form.payoutNotes,
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

  async function deletePayoutEntry(payoutId) {
    if (!window.confirm(tr("Delete this payout record?", "حذف سجل التحويل المالي هذا؟"))) return;
    try {
      await onUpdateUser(editingId, {
        deletePayoutId: payoutId
      });
      toast.success(tr("Payout record deleted.", "تم حذف سجل التحويل."));
    } catch (error) {
      toast.error(tr("Could not delete payout record.", "تعذر حذف سجل التحويل."));
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
              "Create internal accounts, configure permissions, and log payment payouts.",
              "أنشئ حسابات داخلية، واضبط الصلاحيات، وسجل الحوالات المالية."
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

          <label>
            {tr("Vodafone Cash Wallet", "رقم الكاش (فودافون إلخ)")}
            <input 
              placeholder="01xxxxxxxxx"
              value={form.cashNumber} 
              onChange={(event) => update("cashNumber", event.target.value)} 
            />
          </label>
          <label>
            {tr("InstaPay Address", "عنوان انستا باي")}
            <input 
              placeholder="name@instapay"
              value={form.instapayAddress} 
              onChange={(event) => update("instapayAddress", event.target.value)} 
            />
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

          <label className="checkbox-field span-2">
            <input
              type="checkbox"
              checked={Boolean(form.canViewOnlineOrders)}
              onChange={(event) => update("canViewOnlineOrders", event.target.checked)}
            />
            {tr("Can view and manage Online Orders", "صلاحية رؤية وإدارة طلبات الويب سايت أونلاين")}
          </label>

          {/* Log Payout Fields in Edit Mode */}
          {editingId && (
            <div className="span-2 panel" style={{ border: "1px solid var(--primary)", padding: "1.25rem", marginTop: "1rem" }}>
              <h4 style={{ margin: "0 0 1rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Coins size={18} />
                {tr("Send / Log Payout Transfer", "تسجيل تحويل مالي / عمولة")}
              </h4>
              <div className="form-grid">
                <label>
                  {tr("Payout Amount (EGP)", "مبلغ التحويل (ج.م)")}
                  <input
                    type="number"
                    min="0"
                    placeholder="0.00"
                    value={form.payoutAmount}
                    onChange={(event) => update("payoutAmount", event.target.value)}
                  />
                </label>
                <label>
                  {tr("Notes / Reference", "ملاحظات / رقم المعاملة")}
                  <input
                    placeholder={tr("e.g. Vodafone cash transfer ref #", "مثال: تم التحويل فودافون كاش")}
                    value={form.payoutNotes}
                    onChange={(event) => update("payoutNotes", event.target.value)}
                  />
                </label>
              </div>
            </div>
          )}

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

      {/* Selected User Payout History (Show if editing and user has payout records) */}
      {editingId && selectedUser && (
        <section className="panel">
          <div className="panel-head" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <History size={18} style={{ color: "var(--primary)" }} />
            <h3>{tr("Payout History Ledger", "سجل التحويلات المالية للموظف")}</h3>
          </div>
          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table>
              <thead>
                <tr>
                  <th>{tr("Date", "التاريخ")}</th>
                  <th>{tr("Amount", "المبلغ")}</th>
                  <th>{tr("Notes", "ملاحظات")}</th>
                  <th>{tr("Action", "إجراء")}</th>
                </tr>
              </thead>
              <tbody>
                {(!selectedUser.payoutHistory || selectedUser.payoutHistory.length === 0) ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "var(--text-secondary)" }}>
                      {tr("No payout records found.", "لا توجد سجلات تحويل مالي.")}
                    </td>
                  </tr>
                ) : (
                  selectedUser.payoutHistory.map((payout) => (
                    <tr key={payout.id}>
                      <td>{formatDateTime(payout.createdAt)}</td>
                      <td style={{ fontWeight: "700", color: "var(--primary)" }}>
                        {money.format(payout.amount)}
                      </td>
                      <td>{payout.notes || "-"}</td>
                      <td>
                        <button
                          type="button"
                          className="secondary-btn danger-outline"
                          style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                          onClick={() => deletePayoutEntry(payout.id)}
                        >
                          <Trash2 size={12} />
                          {tr("Delete", "حذف")}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
                <th>{tr("Web Orders Perm", "رؤية طلبات الويب")}</th>
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
                        {(user.cashNumber || user.instapayAddress) ? (
                          <span style={{ fontSize: "0.8rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.25rem" }}>
                            {user.cashNumber && (
                              <span style={{ display: "flex", alignItems: "center", gap: "0.15rem" }}>
                                <Coins size={12} />
                                {user.cashNumber}
                              </span>
                            )}
                            {user.cashNumber && user.instapayAddress && <span>•</span>}
                            {user.instapayAddress && (
                              <span style={{ display: "flex", alignItems: "center", gap: "0.15rem" }}>
                                <Landmark size={12} />
                                {user.instapayAddress}
                              </span>
                            )}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td>{user.username}</td>
                  <td>{roleLabel(user.role, tr)}</td>
                  <td>{user.isActive ? tr("Active", "نشط") : tr("Disabled", "معطل")}</td>
                  <td>
                    {user.canViewOnlineOrders !== false ? (
                      <span style={{ color: "#10b981", display: "flex", alignItems: "center", gap: "0.25rem", fontWeight: "600", fontSize: "0.85rem" }}>
                        <Eye size={14} />
                        {tr("Allowed", "مسموح")}
                      </span>
                    ) : (
                      <span style={{ color: "#ef4444", display: "flex", alignItems: "center", gap: "0.25rem", fontWeight: "600", fontSize: "0.85rem" }}>
                        <EyeOff size={14} />
                        {tr("Blocked", "محجوب")}
                      </span>
                    )}
                  </td>
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
