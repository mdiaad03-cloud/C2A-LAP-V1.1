import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Pencil, Trash2, Upload, UserPlus, X, Coins, Eye, EyeOff, Landmark, History, Wallet, User as UserIcon, PiggyBank } from "lucide-react";
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
  salary: "",
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
  sales = [],
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

  // Calculate financials for a specific user
  const getUserFinancials = (user) => {
    const userSales = sales.filter((sale) => sale.createdBy === user.id);
    const totalCommissions = userSales.reduce((sum, sale) => sum + Number(sale.profit || 0), 0);
    const baseSalary = Number(user.salary || 0);
    const totalEarnings = totalCommissions + baseSalary;
    const totalPaid = (user.payoutHistory || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const remainingBalance = totalEarnings - totalPaid;
    return {
      totalCommissions,
      baseSalary,
      totalEarnings,
      totalPaid,
      remainingBalance,
      salesCount: userSales.length
    };
  };

  const selectedUserFinancials = useMemo(() => {
    if (!selectedUser) return null;
    return getUserFinancials(selectedUser);
  }, [selectedUser, sales]);

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
      salary: user.salary || 0,
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
      const payload = {
        name: form.name,
        role: form.role,
        avatarUrl: form.avatarUrl,
        isActive: form.isActive,
        cashNumber: form.cashNumber,
        instapayAddress: form.instapayAddress,
        canViewOnlineOrders: form.canViewOnlineOrders,
        salary: form.salary ? Number(form.salary) : 0,
        payoutAmount: form.payoutAmount ? Number(form.payoutAmount) : undefined,
        payoutNotes: form.payoutNotes,
        ...(form.password ? { password: form.password } : {}),
      };

      if (editingId) {
        await onUpdateUser(editingId, payload);
        toast.success(tr("User updated.", "تم تحديث المستخدم."));
      } else {
        await onCreateUser({
          ...form,
          salary: form.salary ? Number(form.salary) : 0,
        });
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
              "Create internal accounts, configure permissions, basic salaries, and log payouts.",
              "أنشئ حسابات داخلية، واضبط الصلاحيات، والرواتب الأساسية، وسجل الحوالات المالية."
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
            {tr("Basic Salary (EGP)", "المرتب الأساسي (ج.م)")}
            <input 
              type="number"
              min="0"
              placeholder="0"
              value={form.salary} 
              onChange={(event) => update("salary", event.target.value)} 
            />
          </label>
          <label>
            {tr("Vodafone Cash Wallet", "رقم الكاش (فودافون إلخ)")}
            <input 
              placeholder="01xxxxxxxxx"
              value={form.cashNumber} 
              onChange={(event) => update("cashNumber", event.target.value)} 
            />
          </label>
          <label className="span-2">
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
                {tr("Send / Log Payout Transfer", "تسجيل تحويل مالي / تسوية حساب")}
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

      {/* Selected User Financials and Payout History */}
      {editingId && selectedUser && selectedUserFinancials && (
        <section className="panel" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", borderBottom: "1px solid var(--line)", paddingBottom: "0.75rem" }}>
            <Wallet size={20} style={{ color: "var(--primary)" }} />
            <h3 style={{ margin: 0 }}>{tr("Financial Statement Summary", "كشف حساب وتسوية الموظف")}</h3>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
            <div className="panel" style={{ padding: "1rem", backgroundColor: "var(--bg-body)", border: "1px solid var(--line)" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{tr("Basic Salary", "المرتب الأساسي")}</span>
              <h4 style={{ margin: "0.5rem 0 0", fontSize: "1.3rem", color: "var(--text-primary)" }}>{money.format(selectedUserFinancials.baseSalary)}</h4>
            </div>
            <div className="panel" style={{ padding: "1rem", backgroundColor: "var(--bg-body)", border: "1px solid var(--line)" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{tr("Commissions Earned", "إجمالي العمولات")}</span>
              <h4 style={{ margin: "0.5rem 0 0", fontSize: "1.3rem", color: "var(--primary)" }}>{money.format(selectedUserFinancials.totalCommissions)}</h4>
              <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{selectedUserFinancials.salesCount} {tr("Sales records", "عمليات بيع")}</span>
            </div>
            <div className="panel" style={{ padding: "1rem", backgroundColor: "var(--bg-body)", border: "1px solid var(--line)" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{tr("Total Paid (Transferred)", "إجمالي ما تم تحويله")}</span>
              <h4 style={{ margin: "0.5rem 0 0", fontSize: "1.3rem", color: "var(--text-primary)" }}>{money.format(selectedUserFinancials.totalPaid)}</h4>
            </div>
            <div className="panel" style={{ padding: "1rem", backgroundColor: "var(--bg-body)", border: "1px solid var(--primary)", boxShadow: "0 0 8px rgba(15,118,110,0.15)" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{tr("Remaining Balance Due", "المتبقي للتحويل له")}</span>
              <h4 style={{ margin: "0.5rem 0 0", fontSize: "1.4rem", fontWeight: "700", color: selectedUserFinancials.remainingBalance >= 0 ? "#10b981" : "#ef4444" }}>
                {money.format(selectedUserFinancials.remainingBalance)}
              </h4>
            </div>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <h4 style={{ margin: "0 0 1rem", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <History size={16} />
              {tr("Payout Ledger History", "سجل الدفوعات والتحويلات")}
            </h4>
            <div className="table-wrap">
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
          </div>
        </section>
      )}

      <section className="panel table-panel">
        <div className="panel-head">
          <h3>{tr("System Users", "مستخدمو النظام")}</h3>
          <span>{tr("Delete accounts, review roles, track basic salaries and payout balances.", "احذف الحسابات، وراجع الأدوار، وتابع الرواتب الأساسية ومتبقي التحويلات لكل موظف.")}</span>
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
              {sortedUsers.map((user) => {
                const financials = getUserFinancials(user);

                return (
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

                          {/* Dynamic Financial Overview */}
                          {user.role === "sales" && (
                            <div style={{ 
                              fontSize: "0.8rem", 
                              marginTop: "0.4rem", 
                              color: "var(--text-secondary)", 
                              display: "flex", 
                              gap: "0.5rem",
                              alignItems: "center",
                              backgroundColor: "var(--bg-body)",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              border: "1px dashed var(--line)",
                              width: "fit-content"
                            }}>
                              <span>{tr("Salary:", "المرتب:")} <strong style={{ color: "var(--text-primary)" }}>{money.format(financials.baseSalary)}</strong></span>
                              <span>•</span>
                              <span>{tr("Paid:", "المدفوع:")} <strong style={{ color: "var(--text-primary)" }}>{money.format(financials.totalPaid)}</strong></span>
                              <span>•</span>
                              <span>
                                {tr("Due Balance:", "متبقي له:")}{" "}
                                <strong style={{ color: financials.remainingBalance >= 0 ? "#10b981" : "#ef4444" }}>
                                  {money.format(financials.remainingBalance)}
                                </strong>
                              </span>
                            </div>
                          )}
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
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
