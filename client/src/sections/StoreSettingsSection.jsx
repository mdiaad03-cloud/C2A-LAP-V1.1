import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Database, Download, Mail, Plus, Save, Settings2, Trash2 } from "lucide-react";
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from "../components/socialIcons";

const blankFaqItem = (index = 0) => ({
  id: String(index + 1).padStart(2, "0"),
  question: "",
  questionAr: "",
  answer: "",
  answerAr: "",
});

const defaultAgentSettings = {
  productDraftEnabled: true,
  supportReplyEnabled: true,
  shippingAgentEnabled: true,
  excelImportEnabled: true,
  autoMoveTicketsToInProgress: true,
  defaultShippingCompanyName: "Bosta",
  defaultShippingStatus: "pickup_requested",
  productDescriptionTone: "professional",
  supportReplyTone: "friendly",
  defaultWarrantyMonths: 12,
  priceMarkupEnabled: false,
  priceMarkupType: "fixed",
  priceMarkupValue: 0,
};

const blank = {
  shippingFlatRate: "25",
  freeShippingThreshold: "2000",
  lowStockThreshold: "3",
  maxCouponsPerOrder: "1",
  categoriesText: "",
  heroBadge: "",
  heroBadgeAr: "",
  heroTitle: "",
  heroTitleAr: "",
  heroSubtitle: "",
  heroSubtitleAr: "",
  primaryCtaLabel: "",
  primaryCtaLabelAr: "",
  secondaryCtaLabel: "",
  secondaryCtaLabelAr: "",
  featuredTitle: "",
  featuredTitleAr: "",
  offersTitle: "",
  offersTitleAr: "",
  offersSubtitle: "",
  offersSubtitleAr: "",
  brandsTitle: "",
  brandsTitleAr: "",
  faqTitle: "",
  faqTitleAr: "",
  faqSubtitle: "",
  faqSubtitleAr: "",
  features: {
    reviewsEnabled: true,
    cashOnDeliveryEnabled: true,
    paymobEnabled: true,
    paymobComingSoon: false,
    instapayEnabled: true,
    instapayComingSoon: false,
    instapayAddress: "",
    instapayLink: "",
  },
  faqItems: [blankFaqItem(0), blankFaqItem(1), blankFaqItem(2), blankFaqItem(3)],
  socialLinks: {
    whatsapp: { enabled: false, url: "" },
    facebook: { enabled: false, url: "" },
    instagram: { enabled: false, url: "" },
    tiktok: { enabled: false, url: "" },
  },
  agentSettings: defaultAgentSettings,
};

function BilingualField({
  labelEn,
  labelAr,
  valueEn,
  valueAr,
  onChangeEn,
  onChangeAr,
  textarea = false,
  placeholderEn = "",
  placeholderAr = "",
  className = "",
}) {
  const InputTag = textarea ? "textarea" : "input";

  return (
    <div className={`span-2 section-stack ${className}`.trim()}>
      <div className="panel-head row-head">
        <div>
          <h3>{labelEn}</h3>
          <span>{labelAr}</span>
        </div>
      </div>
      <div className="form-grid">
        <label>
          English
          <InputTag value={valueEn} onChange={(event) => onChangeEn(event.target.value)} placeholder={placeholderEn} />
        </label>
        <label>
          العربية
          <InputTag
            value={valueAr}
            onChange={(event) => onChangeAr(event.target.value)}
            placeholder={placeholderAr}
            dir="rtl"
          />
        </label>
      </div>
    </div>
  );
}

function SocialLinkEditor({ title, titleAr, icon, value, onToggle, onChangeUrl, lang = "en" }) {
  const isArabic = lang === "ar";
  const tr = (en, ar) => (isArabic ? ar : en);

  return (
    <div className="panel table-panel">
      <div className="panel-head row-head">
        <div>
          <h3>{tr(title, titleAr)}</h3>
        </div>
        <label className="checkbox-field">
          <input type="checkbox" checked={Boolean(value?.enabled)} onChange={(event) => onToggle(event.target.checked)} />
          {tr("Show", "إظهار")}
        </label>
      </div>
      <label>
        {tr("Link / URL", "الرابط")}
        <div className="inline-actions">
          <span className="store-social-admin-icon" aria-hidden="true">
            {icon}
          </span>
          <input
            value={value?.url || ""}
            onChange={(event) => onChangeUrl(event.target.value)}
            placeholder="https://..."
            dir="ltr"
          />
        </div>
      </label>
    </div>
  );
}

export default function StoreSettingsSection({ settings, onSave, onSendTestEmail, onDownloadBackup, onDownloadSalesExcel, lang = "en" }) {
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const isArabic = lang === "ar";
  const tr = (en, ar) => (isArabic ? ar : en);

  useEffect(() => {
    const faqItems =
      Array.isArray(settings?.content?.faqItems) && settings.content.faqItems.length > 0
        ? settings.content.faqItems.map((item, index) => ({
            id: item?.id || String(index + 1).padStart(2, "0"),
            question: item?.question || "",
            questionAr: item?.questionAr || "",
            answer: item?.answer || "",
            answerAr: item?.answerAr || "",
          }))
        : blank.faqItems;

    setForm({
      shippingFlatRate: String(settings?.shippingFlatRate ?? 25),
      freeShippingThreshold: String(settings?.freeShippingThreshold ?? 2000),
      lowStockThreshold: String(settings?.lowStockThreshold ?? 3),
      maxCouponsPerOrder: String(settings?.maxCouponsPerOrder ?? 1),
      categoriesText: Array.isArray(settings?.categories) ? settings.categories.join(", ") : "",
      heroBadge: settings?.content?.heroBadge || "",
      heroBadgeAr: settings?.content?.heroBadgeAr || "",
      heroTitle: settings?.content?.heroTitle || "",
      heroTitleAr: settings?.content?.heroTitleAr || "",
      heroSubtitle: settings?.content?.heroSubtitle || "",
      heroSubtitleAr: settings?.content?.heroSubtitleAr || "",
      primaryCtaLabel: settings?.content?.primaryCtaLabel || "",
      primaryCtaLabelAr: settings?.content?.primaryCtaLabelAr || "",
      secondaryCtaLabel: settings?.content?.secondaryCtaLabel || "",
      secondaryCtaLabelAr: settings?.content?.secondaryCtaLabelAr || "",
      featuredTitle: settings?.content?.featuredTitle || "",
      featuredTitleAr: settings?.content?.featuredTitleAr || "",
      offersTitle: settings?.content?.offersTitle || "",
      offersTitleAr: settings?.content?.offersTitleAr || "",
      offersSubtitle: settings?.content?.offersSubtitle || "",
      offersSubtitleAr: settings?.content?.offersSubtitleAr || "",
      brandsTitle: settings?.content?.brandsTitle || "",
      brandsTitleAr: settings?.content?.brandsTitleAr || "",
      faqTitle: settings?.content?.faqTitle || "",
      faqTitleAr: settings?.content?.faqTitleAr || "",
      faqSubtitle: settings?.content?.faqSubtitle || "",
      faqSubtitleAr: settings?.content?.faqSubtitleAr || "",
      features: {
        reviewsEnabled: settings?.features?.reviewsEnabled !== false,
        cashOnDeliveryEnabled: settings?.features?.cashOnDeliveryEnabled !== false,
        paymobEnabled: settings?.features?.paymobEnabled !== false,
        paymobComingSoon: Boolean(settings?.features?.paymobComingSoon),
        instapayEnabled: settings?.features?.instapayEnabled !== false,
        instapayComingSoon: Boolean(settings?.features?.instapayComingSoon),
        instapayAddress: settings?.features?.instapayAddress || "",
        instapayLink: settings?.features?.instapayLink || "",
      },
      faqItems,
      socialLinks: {
        whatsapp: {
          enabled: Boolean(settings?.socialLinks?.whatsapp?.enabled),
          url: settings?.socialLinks?.whatsapp?.url || "",
        },
        facebook: {
          enabled: Boolean(settings?.socialLinks?.facebook?.enabled),
          url: settings?.socialLinks?.facebook?.url || "",
        },
        instagram: {
          enabled: Boolean(settings?.socialLinks?.instagram?.enabled),
          url: settings?.socialLinks?.instagram?.url || "",
        },
        tiktok: {
          enabled: Boolean(settings?.socialLinks?.tiktok?.enabled),
          url: settings?.socialLinks?.tiktok?.url || "",
        },
      },
      agentSettings: {
        ...defaultAgentSettings,
        ...(settings?.agentSettings || {}),
      },
    });
  }, [settings]);

  const canAddFaq = form.faqItems.length < 8;
  const visibleFaqItems = useMemo(
    () => form.faqItems.map((item, index) => ({ ...item, id: item.id || String(index + 1).padStart(2, "0") })),
    [form.faqItems],
  );

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateFeature(key, value) {
    setForm((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        [key]: value,
      },
    }));
  }

  function updateFaq(index, field, value) {
    setForm((prev) => ({
      ...prev,
      faqItems: prev.faqItems.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    }));
  }

  function updateSocial(platform, field, value) {
    setForm((prev) => ({
      ...prev,
      socialLinks: {
        ...prev.socialLinks,
        [platform]: {
          ...prev.socialLinks[platform],
          [field]: value,
        },
      },
    }));
  }

  function updateAgentSetting(field, value) {
    setForm((prev) => ({
      ...prev,
      agentSettings: {
        ...prev.agentSettings,
        [field]: value,
      },
    }));
  }

  function addFaqItem() {
    if (!canAddFaq) {
      return;
    }
    setForm((prev) => ({
      ...prev,
      faqItems: [...prev.faqItems, blankFaqItem(prev.faqItems.length)],
    }));
  }

  function removeFaqItem(index) {
    setForm((prev) => {
      const next = prev.faqItems.filter((_, itemIndex) => itemIndex !== index);
      return {
        ...prev,
        faqItems: next.length > 0 ? next : [blankFaqItem(0)],
      };
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (saving) {
      return;
    }

    setSaving(true);
    try {
      await onSave({
        shippingFlatRate: Number(form.shippingFlatRate || 0),
        freeShippingThreshold: Number(form.freeShippingThreshold || 0),
        lowStockThreshold: Number(form.lowStockThreshold || 3),
        maxCouponsPerOrder: Number(form.maxCouponsPerOrder || 1),
        categories: form.categoriesText,
        content: {
          heroBadge: form.heroBadge,
          heroBadgeAr: form.heroBadgeAr,
          heroTitle: form.heroTitle,
          heroTitleAr: form.heroTitleAr,
          heroSubtitle: form.heroSubtitle,
          heroSubtitleAr: form.heroSubtitleAr,
          primaryCtaLabel: form.primaryCtaLabel,
          primaryCtaLabelAr: form.primaryCtaLabelAr,
          secondaryCtaLabel: form.secondaryCtaLabel,
          secondaryCtaLabelAr: form.secondaryCtaLabelAr,
          featuredTitle: form.featuredTitle,
          featuredTitleAr: form.featuredTitleAr,
          offersTitle: form.offersTitle,
          offersTitleAr: form.offersTitleAr,
          offersSubtitle: form.offersSubtitle,
          offersSubtitleAr: form.offersSubtitleAr,
          brandsTitle: form.brandsTitle,
          brandsTitleAr: form.brandsTitleAr,
          faqTitle: form.faqTitle,
          faqTitleAr: form.faqTitleAr,
          faqSubtitle: form.faqSubtitle,
          faqSubtitleAr: form.faqSubtitleAr,
          faqItems: visibleFaqItems,
        },
        features: {
          reviewsEnabled: form.features?.reviewsEnabled !== false,
          cashOnDeliveryEnabled: form.features?.cashOnDeliveryEnabled !== false,
          paymobEnabled: form.features?.paymobEnabled !== false,
          paymobComingSoon: Boolean(form.features?.paymobComingSoon),
          instapayEnabled: form.features?.instapayEnabled !== false,
          instapayComingSoon: Boolean(form.features?.instapayComingSoon),
          instapayAddress: form.features?.instapayAddress || "",
          instapayLink: form.features?.instapayLink || "",
        },
        socialLinks: form.socialLinks,
        agentSettings: form.agentSettings,
      });
      toast.success(tr("Store settings saved.", "تم حفظ إعدادات المتجر."));
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Could not save store settings.", "تعذر حفظ إعدادات المتجر."));
    } finally {
      setSaving(false);
    }
  }

  async function sendTestEmail() {
    if (!onSendTestEmail || !testEmailTo || testEmailLoading) {
      return;
    }

    setTestEmailLoading(true);
    try {
      await onSendTestEmail({
        to: testEmailTo,
        subject: tr("C2A LAP test email", "رسالة اختبار من C2A LAP"),
        body: tr("This is a test email from the system settings screen.", "هذه رسالة اختبار من شاشة إعدادات النظام."),
      });
      toast.success(tr("Test email sent successfully.", "تم إرسال رسالة الاختبار بنجاح."));
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Could not send test email.", "تعذر إرسال رسالة الاختبار."));
    } finally {
      setTestEmailLoading(false);
    }
  }

  return (
    <section className="panel form-panel">
      <div className="panel-head">
        <h3>{tr("Store Settings", "إعدادات المتجر")}</h3>
        <span>
          {tr(
            "Manage storefront texts, FAQ content, social links, and agent automation settings.",
            "أدر نصوص المتجر ومحتوى الأسئلة الشائعة وروابط التواصل وإعدادات الأتمتة الخاصة بالإيجنت.",
          )}
        </span>
      </div>

      <form className="form-grid" onSubmit={submit}>
        <label>
          {tr("Shipping Flat Rate", "سعر الشحن الثابت")}
          <input type="number" min="0" value={form.shippingFlatRate} onChange={(event) => update("shippingFlatRate", event.target.value)} />
        </label>
        <label>
          {tr("Free Shipping Threshold", "حد الشحن المجاني")}
          <input
            type="number"
            min="0"
            value={form.freeShippingThreshold}
            onChange={(event) => update("freeShippingThreshold", event.target.value)}
          />
        </label>
        <label>
          {tr("Low Stock Threshold", "حد انخفاض المخزون")}
          <input type="number" min="1" value={form.lowStockThreshold} onChange={(event) => update("lowStockThreshold", event.target.value)} />
        </label>
        <label>
          {tr("Max Coupons Per Order", "أقصى عدد كوبونات لكل طلب")}
          <input type="number" min="1" max="5" value={form.maxCouponsPerOrder} onChange={(event) => update("maxCouponsPerOrder", event.target.value)} />
        </label>
        <label className="span-2">
          {tr("Categories (comma separated)", "الفئات مفصولة بفواصل")}
          <input
            value={form.categoriesText}
            onChange={(event) => update("categoriesText", event.target.value)}
            placeholder={tr("Gaming, Business, Student", "ألعاب، أعمال، طلاب")}
          />
        </label>

        <BilingualField
          labelEn="Hero Badge"
          labelAr="شارة الهيرو"
          valueEn={form.heroBadge}
          valueAr={form.heroBadgeAr}
          onChangeEn={(value) => update("heroBadge", value)}
          onChangeAr={(value) => update("heroBadgeAr", value)}
        />
        <BilingualField
          labelEn="Hero Title"
          labelAr="عنوان الهيرو"
          valueEn={form.heroTitle}
          valueAr={form.heroTitleAr}
          onChangeEn={(value) => update("heroTitle", value)}
          onChangeAr={(value) => update("heroTitleAr", value)}
          textarea
        />
        <BilingualField
          labelEn="Hero Subtitle"
          labelAr="وصف الهيرو"
          valueEn={form.heroSubtitle}
          valueAr={form.heroSubtitleAr}
          onChangeEn={(value) => update("heroSubtitle", value)}
          onChangeAr={(value) => update("heroSubtitleAr", value)}
          textarea
        />
        <BilingualField
          labelEn="Primary CTA"
          labelAr="الزر الأساسي"
          valueEn={form.primaryCtaLabel}
          valueAr={form.primaryCtaLabelAr}
          onChangeEn={(value) => update("primaryCtaLabel", value)}
          onChangeAr={(value) => update("primaryCtaLabelAr", value)}
        />
        <BilingualField
          labelEn="Secondary CTA"
          labelAr="الزر الثانوي"
          valueEn={form.secondaryCtaLabel}
          valueAr={form.secondaryCtaLabelAr}
          onChangeEn={(value) => update("secondaryCtaLabel", value)}
          onChangeAr={(value) => update("secondaryCtaLabelAr", value)}
        />
        <BilingualField
          labelEn="Featured Section Title"
          labelAr="عنوان القسم المميز"
          valueEn={form.featuredTitle}
          valueAr={form.featuredTitleAr}
          onChangeEn={(value) => update("featuredTitle", value)}
          onChangeAr={(value) => update("featuredTitleAr", value)}
        />
        <BilingualField
          labelEn="Offers Title"
          labelAr="عنوان العروض"
          valueEn={form.offersTitle}
          valueAr={form.offersTitleAr}
          onChangeEn={(value) => update("offersTitle", value)}
          onChangeAr={(value) => update("offersTitleAr", value)}
        />
        <BilingualField
          labelEn="Offers Subtitle"
          labelAr="وصف العروض"
          valueEn={form.offersSubtitle}
          valueAr={form.offersSubtitleAr}
          onChangeEn={(value) => update("offersSubtitle", value)}
          onChangeAr={(value) => update("offersSubtitleAr", value)}
          textarea
        />
        <BilingualField
          labelEn="Brands Title"
          labelAr="عنوان البراندات"
          valueEn={form.brandsTitle}
          valueAr={form.brandsTitleAr}
          onChangeEn={(value) => update("brandsTitle", value)}
          onChangeAr={(value) => update("brandsTitleAr", value)}
        />
        <BilingualField
          labelEn="FAQ Title"
          labelAr="عنوان الأسئلة الشائعة"
          valueEn={form.faqTitle}
          valueAr={form.faqTitleAr}
          onChangeEn={(value) => update("faqTitle", value)}
          onChangeAr={(value) => update("faqTitleAr", value)}
        />
        <BilingualField
          labelEn="FAQ Subtitle"
          labelAr="وصف الأسئلة الشائعة"
          valueEn={form.faqSubtitle}
          valueAr={form.faqSubtitleAr}
          onChangeEn={(value) => update("faqSubtitle", value)}
          onChangeAr={(value) => update("faqSubtitleAr", value)}
          textarea
        />

        <section className="span-2 panel table-panel">
          <div className="panel-head row-head">
            <div>
              <h3>{tr("FAQ Items", "عناصر الأسئلة الشائعة")}</h3>
              <span>{tr("Each item supports English and Arabic.", "كل عنصر يدعم الإنجليزية والعربية.")}</span>
            </div>
            <button type="button" className="secondary-btn" onClick={addFaqItem} disabled={!canAddFaq}>
              <Plus size={16} />
              {tr("Add FAQ", "إضافة سؤال")}
            </button>
          </div>

          <div className="section-stack">
            {visibleFaqItems.map((item, index) => (
              <div key={item.id} className="panel faq-editor-card">
                <div className="panel-head row-head">
                  <div>
                    <h3>
                      {tr("Question", "سؤال")} {item.id}
                    </h3>
                  </div>
                  <button type="button" className="icon-btn danger" onClick={() => removeFaqItem(index)} aria-label="Remove FAQ item">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="form-grid">
                  <label>
                    {tr("Question (EN)", "السؤال بالإنجليزية")}
                    <input value={item.question} onChange={(event) => updateFaq(index, "question", event.target.value)} />
                  </label>
                  <label>
                    {tr("Question (AR)", "السؤال بالعربية")}
                    <input dir="rtl" value={item.questionAr} onChange={(event) => updateFaq(index, "questionAr", event.target.value)} />
                  </label>
                  <label>
                    {tr("Answer (EN)", "الإجابة بالإنجليزية")}
                    <textarea value={item.answer} onChange={(event) => updateFaq(index, "answer", event.target.value)} />
                  </label>
                  <label>
                    {tr("Answer (AR)", "الإجابة بالعربية")}
                    <textarea dir="rtl" value={item.answerAr} onChange={(event) => updateFaq(index, "answerAr", event.target.value)} />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="span-2 panel table-panel">
          <div className="panel-head row-head">
            <div>
              <h3>{tr("Social Links", "روابط التواصل")}</h3>
              <span>{tr("Enable only the links you want to show in the storefront.", "فعّل فقط الروابط التي تريد إظهارها في المتجر.")}</span>
            </div>
          </div>
          <div className="agent-grid">
            <SocialLinkEditor
              title="WhatsApp"
              titleAr="واتساب"
              icon={<WhatsAppIcon size={16} />}
              value={form.socialLinks.whatsapp}
              onToggle={(checked) => updateSocial("whatsapp", "enabled", checked)}
              onChangeUrl={(value) => updateSocial("whatsapp", "url", value)}
              lang={lang}
            />
            <SocialLinkEditor
              title="Facebook"
              titleAr="فيسبوك"
              icon={<FacebookIcon size={16} />}
              value={form.socialLinks.facebook}
              onToggle={(checked) => updateSocial("facebook", "enabled", checked)}
              onChangeUrl={(value) => updateSocial("facebook", "url", value)}
              lang={lang}
            />
            <SocialLinkEditor
              title="Instagram"
              titleAr="إنستجرام"
              icon={<InstagramIcon size={16} />}
              value={form.socialLinks.instagram}
              onToggle={(checked) => updateSocial("instagram", "enabled", checked)}
              onChangeUrl={(value) => updateSocial("instagram", "url", value)}
              lang={lang}
            />
            <SocialLinkEditor
              title="TikTok"
              titleAr="تيك توك"
              icon={<TikTokIcon size={16} />}
              value={form.socialLinks.tiktok}
              onToggle={(checked) => updateSocial("tiktok", "enabled", checked)}
              onChangeUrl={(value) => updateSocial("tiktok", "url", value)}
              lang={lang}
            />
          </div>
        </section>

        <section className="span-2 panel table-panel">
          <div className="panel-head row-head">
            <div>
              <h3>{tr("Payment Methods Settings", "إعدادات وسائل الدفع")}</h3>
              <span>{tr("Configure which payment methods are enabled or marked as 'Coming Soon'.", "اضبط وسائل الدفع المفعلة أو التي تظهر كـ 'يتوفر قريباً'.")}</span>
            </div>
          </div>
          <div className="form-grid" style={{ padding: "16px", gap: "16px" }}>
            <div style={{ display: "grid", gap: "10px", padding: "12px", border: "1px solid var(--line)", borderRadius: "10px", background: "rgba(0,0,0,0.01)" }}>
              <label className="checkbox-field" style={{ fontWeight: "700" }}>
                <input
                  type="checkbox"
                  checked={form.features?.cashOnDeliveryEnabled !== false}
                  onChange={(event) => updateFeature("cashOnDeliveryEnabled", event.target.checked)}
                />
                {tr("Enable Cash On Delivery", "تفعيل الدفع عند الاستلام")}
              </label>
              <p style={{ margin: "0", fontSize: "0.82rem", color: "var(--muted)" }}>
                {tr("Allow customers to pay cash when order is delivered.", "السماح للعملاء بالدفع نقداً عند استلام الشحنة.")}
              </p>
            </div>

            <div style={{ display: "grid", gap: "10px", padding: "12px", border: "1px solid var(--line)", borderRadius: "10px", background: "rgba(0,0,0,0.01)" }}>
              <label className="checkbox-field" style={{ fontWeight: "700" }}>
                <input
                  type="checkbox"
                  checked={form.features?.paymobEnabled !== false}
                  onChange={(event) => updateFeature("paymobEnabled", event.target.checked)}
                />
                {tr("Enable Paymob (Credit Card / Wallet)", "تفعيل باي موب (بطاقات / محفظة)")}
              </label>
              <label className="checkbox-field" style={{ fontSize: "0.88rem", paddingInlineStart: "20px" }}>
                <input
                  type="checkbox"
                  disabled={form.features?.paymobEnabled === false}
                  checked={Boolean(form.features?.paymobComingSoon)}
                  onChange={(event) => updateFeature("paymobComingSoon", event.target.checked)}
                />
                {tr("Mark as 'Coming Soon'", "إظهار كـ 'يتوفر قريباً ⏳'")}
              </label>
              <p style={{ margin: "0", fontSize: "0.82rem", color: "var(--muted)" }}>
                {tr("Accept card and mobile wallet payments via Paymob Egypt (Includes free shipping).", "قبول الدفع بالبطاقات والمحافظ الإلكترونية عبر باي موب مصر (شحن مجاني تلقائياً).")}
              </p>
            </div>

            <div style={{ display: "grid", gap: "10px", padding: "12px", border: "1px solid var(--line)", borderRadius: "10px", background: "rgba(0,0,0,0.01)" }}>
              <label className="checkbox-field" style={{ fontWeight: "700" }}>
                <input
                  type="checkbox"
                  checked={form.features?.instapayEnabled !== false}
                  onChange={(event) => updateFeature("instapayEnabled", event.target.checked)}
                />
                {tr("Enable InstaPay", "تفعيل انستا باي")}
              </label>
              <label className="checkbox-field" style={{ fontSize: "0.88rem", paddingInlineStart: "20px" }}>
                <input
                  type="checkbox"
                  disabled={form.features?.instapayEnabled === false}
                  checked={Boolean(form.features?.instapayComingSoon)}
                  onChange={(event) => updateFeature("instapayComingSoon", event.target.checked)}
                />
                {tr("Mark as 'Coming Soon'", "إظهار كـ 'يتوفر قريباً ⏳'")}
              </label>
              {form.features?.instapayEnabled !== false && (
                <>
                  <label style={{ paddingInlineStart: "20px", display: "grid", gap: "6px" }}>
                    {tr("InstaPay Phone Number / IPN Address", "رقم الهاتف أو عنوان انستا باي (IPN)")}
                    <input
                      type="text"
                      value={form.features?.instapayAddress || ""}
                      onChange={(event) => updateFeature("instapayAddress", event.target.value)}
                      placeholder="e.g. 01068646465 or username@instapay"
                      style={{ maxWidth: "340px", padding: "8px", border: "1px solid var(--line)", borderRadius: "8px", background: "var(--panel)" }}
                    />
                  </label>
                  <label style={{ paddingInlineStart: "20px", display: "grid", gap: "6px", marginTop: "8px" }}>
                    {tr("InstaPay Direct Payment Link", "رابط الدفع المباشر لانستا باي")}
                    <input
                      type="text"
                      value={form.features?.instapayLink || ""}
                      onChange={(event) => updateFeature("instapayLink", event.target.value)}
                      placeholder="e.g. https://ipn.eg/S/..."
                      style={{ maxWidth: "340px", padding: "8px", border: "1px solid var(--line)", borderRadius: "8px", background: "var(--panel)" }}
                    />
                  </label>
                </>
              )}
              <p style={{ margin: "0", fontSize: "0.82rem", color: "var(--muted)" }}>
                {tr("Allow customers to pay via InstaPay app transfer (Includes free shipping).", "السماح للعملاء بالدفع عن طريق تحويل تطبيق انستا باي (شحن مجاني تلقائياً).")}
              </p>
            </div>
          </div>
        </section>

        <section className="span-2 panel table-panel">
          <div className="panel-head row-head">
            <div>
              <h3>{tr("Agent Settings", "إعدادات الإيجنت")}</h3>
              <span>{tr("Control automation for products, support, shipping, and Excel imports.", "تحكم في أتمتة المنتجات والدعم والشحن واستيراد الإكسل.")}</span>
            </div>
            <span className="agent-icon-badge">
              <Settings2 size={18} />
            </span>
          </div>
          <div className="form-grid">
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.agentSettings.productDraftEnabled}
                onChange={(event) => updateAgentSetting("productDraftEnabled", event.target.checked)}
              />
              {tr("Enable Product Agent", "تفعيل وكيل المنتجات")}
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.agentSettings.supportReplyEnabled}
                onChange={(event) => updateAgentSetting("supportReplyEnabled", event.target.checked)}
              />
              {tr("Enable Support Agent", "تفعيل وكيل الدعم")}
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.agentSettings.shippingAgentEnabled}
                onChange={(event) => updateAgentSetting("shippingAgentEnabled", event.target.checked)}
              />
              {tr("Enable Shipping Agent", "تفعيل وكيل الشحن")}
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.agentSettings.excelImportEnabled}
                onChange={(event) => updateAgentSetting("excelImportEnabled", event.target.checked)}
              />
              {tr("Enable Excel Import", "تفعيل استيراد الإكسل")}
            </label>
            <label className="checkbox-field span-2">
              <input
                type="checkbox"
                checked={form.agentSettings.autoMoveTicketsToInProgress}
                onChange={(event) => updateAgentSetting("autoMoveTicketsToInProgress", event.target.checked)}
              />
              {tr("Move support tickets to in progress automatically", "نقل تذاكر الدعم إلى قيد التنفيذ تلقائيًا")}
            </label>
            <label>
              {tr("Default Shipping Company", "شركة الشحن الافتراضية")}
              <input
                value={form.agentSettings.defaultShippingCompanyName}
                onChange={(event) => updateAgentSetting("defaultShippingCompanyName", event.target.value)}
              />
            </label>
            <label>
              {tr("Default Shipping Status", "حالة الشحن الافتراضية")}
              <input
                value={form.agentSettings.defaultShippingStatus}
                onChange={(event) => updateAgentSetting("defaultShippingStatus", event.target.value)}
              />
            </label>
            <label>
              {tr("Product Description Tone", "أسلوب وصف المنتج")}
              <select
                value={form.agentSettings.productDescriptionTone}
                onChange={(event) => updateAgentSetting("productDescriptionTone", event.target.value)}
              >
                <option value="professional">{tr("Professional", "احترافي")}</option>
                <option value="premium">{tr("Premium", "فخم")}</option>
                <option value="technical">{tr("Technical", "تقني")}</option>
              </select>
            </label>
            <label>
              {tr("Support Reply Tone", "أسلوب رد الدعم")}
              <select
                value={form.agentSettings.supportReplyTone}
                onChange={(event) => updateAgentSetting("supportReplyTone", event.target.value)}
              >
                <option value="friendly">{tr("Friendly", "ودود")}</option>
                <option value="formal">{tr("Formal", "رسمي")}</option>
                <option value="short">{tr("Short", "مختصر")}</option>
              </select>
            </label>
            <label>
              {tr("Default Warranty (Months)", "الضمان الافتراضي (بالأشهر)")}
              <input
                type="number"
                min="1"
                value={form.agentSettings.defaultWarrantyMonths || 12}
                onChange={(event) => updateAgentSetting("defaultWarrantyMonths", Math.max(1, Number.parseInt(event.target.value, 10) || 12))}
              />
            </label>
            <div className="span-2 form-grid" style={{ padding: "12px", background: "rgba(0,0,0,0.02)", borderRadius: "10px", border: "1px solid var(--line)", marginTop: "6px" }}>
              <label className="checkbox-field span-2">
                <input
                  type="checkbox"
                  checked={form.agentSettings.priceMarkupEnabled || false}
                  onChange={(event) => updateAgentSetting("priceMarkupEnabled", event.target.checked)}
                />
                {tr("Apply Profit Markup to Excel Prices", "تطبيق مكسب إضافي على أسعار الشيت")}
              </label>
              {form.agentSettings.priceMarkupEnabled && (
                <>
                  <label>
                    {tr("Markup Type", "نوع المكسب")}
                    <select
                      value={form.agentSettings.priceMarkupType || "fixed"}
                      onChange={(event) => updateAgentSetting("priceMarkupType", event.target.value)}
                    >
                      <option value="fixed">{tr("Fixed Amount (EGP)", "مبلغ ثابت (ج.م)")}</option>
                      <option value="percent">{tr("Percentage (%)", "نسبة مئوية (%)")}</option>
                    </select>
                  </label>
                  <label>
                    {tr("Markup Value", "قيمة المكسب")}
                    <input
                      type="number"
                      min="0"
                      value={form.agentSettings.priceMarkupValue || 0}
                      onChange={(event) => updateAgentSetting("priceMarkupValue", Math.max(0, Number(event.target.value) || 0))}
                    />
                  </label>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="span-2 panel table-panel">
          <div className="panel-head row-head">
            <div>
              <h3>{tr("Email Test", "اختبار البريد")}</h3>
              <span>{tr("Send a quick test email to confirm SMTP works before going live.", "أرسل رسالة اختبار سريعة للتأكد من عمل البريد قبل النشر.")}</span>
            </div>
            <span className="agent-icon-badge">
              <Mail size={18} />
            </span>
          </div>
          <div className="inline-actions stretch">
            <input
              type="email"
              value={testEmailTo}
              onChange={(event) => setTestEmailTo(event.target.value)}
              placeholder={tr("recipient@example.com", "recipient@example.com")}
              dir="ltr"
            />
            <button type="button" className="secondary-btn" disabled={testEmailLoading || !testEmailTo} onClick={sendTestEmail}>
              <Mail size={16} />
              {testEmailLoading ? tr("Sending...", "جارٍ الإرسال...") : tr("Send Test Email", "إرسال رسالة اختبار")}
            </button>
          </div>
        </section>

        <section className="span-2 panel table-panel">
          <div className="panel-head row-head">
            <div>
              <h3>{tr("Database Backup & Export", "النسخ الاحتياطي وتصدير البيانات")}</h3>
              <span>{tr("Download a full database backup or download the automatically synchronized Excel sales workbook.", "قم بتنزيل نسخة احتياطية كاملة من قاعدة البيانات أو كتاب العمل لملف إكسيل المزامَن تلقائياً.")}</span>
            </div>
            <span className="agent-icon-badge">
              <Database size={18} />
            </span>
          </div>
          <div className="inline-actions stretch" style={{ gap: "12px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="secondary-btn"
              onClick={onDownloadBackup}
              disabled={!onDownloadBackup}
              style={{ flex: 1, minWidth: "200px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            >
              <Download size={16} />
              {tr("Download JSON Backup", "تحميل النسخة الاحتياطية (JSON)")}
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={onDownloadSalesExcel}
              disabled={!onDownloadSalesExcel}
              style={{ flex: 1, minWidth: "200px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            >
              <Download size={16} />
              {tr("Download Sales Excel", "تحميل شيت المبيعات (Excel)")}
            </button>
          </div>
        </section>

        <label className="span-2 checkbox-field">
          <input type="checkbox" checked={form.features?.reviewsEnabled !== false} onChange={(event) => updateFeature("reviewsEnabled", event.target.checked)} />
          {tr("Show customer review section in storefront", "إظهار قسم تقييمات العملاء في المتجر")}
        </label>

        <button className="primary-btn span-2" type="submit" disabled={saving}>
          <Save size={16} />
          {saving ? tr("Saving...", "جارٍ الحفظ...") : tr("Save Store Settings", "حفظ إعدادات المتجر")}
        </button>
      </form>
    </section>
  );
}
