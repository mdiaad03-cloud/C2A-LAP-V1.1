import { useState } from "react";
import toast from "react-hot-toast";
import { Upload, X, Save, User as UserIcon, Wallet, CreditCard, Lock } from "lucide-react";

export default function ProfileSection({ user, onUpdateProfile, onUploadAvatar, lang = "en" }) {
  const [form, setForm] = useState({
    name: user?.name || "",
    cashNumber: user?.cashNumber || "",
    instapayAddress: user?.instapayAddress || "",
    password: "",
    avatarUrl: user?.avatarUrl || "",
  });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const isArabic = lang === "ar";
  const tr = (en, ar) => (isArabic ? ar : en);

  function update(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleAvatarFile(event) {
    const file = event.target.files?.[0];
    if (!file || uploadingAvatar) {
      return;
    }

    setUploadingAvatar(true);
    try {
      const avatarUrl = await onUploadAvatar(file);
      update("avatarUrl", avatarUrl);
      toast.success(tr("Avatar uploaded.", "تم رفع الصورة الشخصية بنجاح."));
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Could not upload avatar.", "تعذر رفع الصورة الشخصية."));
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
      await onUpdateProfile({
        name: form.name,
        cashNumber: form.cashNumber,
        instapayAddress: form.instapayAddress,
        avatarUrl: form.avatarUrl,
        ...(form.password ? { password: form.password } : {}),
      });
      toast.success(tr("Profile updated successfully.", "تم تحديث الملف الشخصي بنجاح."));
      update("password", "");
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Could not update profile.", "تعذر تحديث الملف الشخصي."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="section-stack" style={{ maxWidth: "800px", margin: "0 auto" }}>
      <section className="panel form-panel">
        <div className="panel-head">
          <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <UserIcon size={20} style={{ color: "var(--primary)" }} />
            {tr("My Profile & Wallet Settings", "ملفي الشخصي وإعدادات المحفظة")}
          </h3>
          <span>
            {tr(
              "Update your personal info, change your login password, and enter your cash wallet/InstaPay details.",
              "قم بتحديث معلوماتك الشخصية، وتغيير كلمة المرور، وإدخال بيانات المحفظة وانستا باي الخاصة بك للتحويلات."
            )}
          </span>
        </div>

        <form className="form-grid" onSubmit={submit}>
          <div className="span-2" style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
            <div className="avatar-upload-block" style={{ flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
              <div 
                className="avatar-badge" 
                style={{ 
                  width: "100px", 
                  height: "100px", 
                  borderRadius: "50%", 
                  overflow: "hidden", 
                  background: "var(--bg-card-hover)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid var(--primary)"
                }}
              >
                {form.avatarUrl ? (
                  <img src={form.avatarUrl} alt={form.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: "2rem", fontWeight: "bold" }}>
                    {(form.name || "U")[0].toUpperCase()}
                  </span>
                )}
              </div>
              
              <div className="inline-actions" style={{ justifyContent: "center" }}>
                <label className="upload-btn" style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}>
                  <Upload size={14} />
                  {uploadingAvatar ? tr("Uploading...", "جارٍ الرفع...") : tr("Change Photo", "تغيير الصورة")}
                  <input type="file" accept="image/*" hidden onChange={handleAvatarFile} />
                </label>
                {form.avatarUrl ? (
                  <button 
                    type="button" 
                    className="secondary-btn" 
                    style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
                    onClick={() => update("avatarUrl", "")}
                  >
                    <X size={14} />
                    {tr("Remove", "إزالة")}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <label>
            {tr("Full Name", "الاسم الكامل")}
            <input 
              value={form.name} 
              onChange={(event) => update("name", event.target.value)} 
              required 
            />
          </label>

          <label>
            {tr("Username (Read-Only)", "اسم المستخدم (للقراءة فقط)")}
            <input 
              value={user?.username || ""} 
              disabled 
              style={{ backgroundColor: "var(--bg-body)", cursor: "not-allowed" }}
            />
          </label>

          <label className="span-2" style={{ borderTop: "1px dashed var(--line)", paddingTop: "1rem", marginTop: "0.5rem" }}>
            <span style={{ fontWeight: "600", display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--primary)" }}>
              <Wallet size={16} />
              {tr("Wallet & Transfer Payout Details", "بيانات المحفظة والتحويل المالي")}
            </span>
          </label>

          <label>
            {tr("Vodafone Cash / Cash Wallet Number", "رقم محفظة كاش (فودافون كاش إلخ)")}
            <input 
              placeholder="01xxxxxxxxx"
              value={form.cashNumber} 
              onChange={(event) => update("cashNumber", event.target.value)} 
            />
          </label>

          <label>
            {tr("InstaPay Address (IPA)", "عنوان انستا باي (InstaPay Address)")}
            <input 
              placeholder="name@instapay"
              value={form.instapayAddress} 
              onChange={(event) => update("instapayAddress", event.target.value)} 
            />
          </label>

          <label className="span-2" style={{ borderTop: "1px dashed var(--line)", paddingTop: "1rem", marginTop: "0.5rem" }}>
            <span style={{ fontWeight: "600", display: "flex", alignItems: "center", gap: "0.4rem", color: "var(--primary)" }}>
              <Lock size={16} />
              {tr("Security & Password Settings", "الأمان وتغيير كلمة المرور")}
            </span>
          </label>

          <label className="span-2">
            {tr("New Password (Optional)", "كلمة مرور جديدة (اختياري)")}
            <input 
              type="password"
              placeholder={tr("Leave blank to keep current password", "اتركها فارغة للإبقاء على كلمة المرور الحالية")}
              value={form.password} 
              onChange={(event) => update("password", event.target.value)} 
            />
          </label>

          <button type="submit" className="primary-btn span-2" disabled={saving}>
            <Save size={16} />
            {saving ? tr("Saving Changes...", "جارٍ حفظ التغييرات...") : tr("Save Settings", "حفظ البيانات")}
          </button>
        </form>
      </section>
    </div>
  );
}
