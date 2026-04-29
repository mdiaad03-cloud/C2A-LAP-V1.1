import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Save, Trash2 } from "lucide-react";
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from "../components/socialIcons";

const blankFaqItem = (index = 0) => ({
  id: String(index + 1).padStart(2, "0"),
  question: "",
  questionAr: "",
  answer: "",
  answerAr: "",
});

const blank = {
  shippingFlatRate: "25",
  freeShippingThreshold: "2000",
  lowStockThreshold: "3",
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
  showReviews: true,
  faqItems: [blankFaqItem(0), blankFaqItem(1), blankFaqItem(2), blankFaqItem(3)],
  socialLinks: {
    whatsapp: { enabled: false, url: "" },
    facebook: { enabled: false, url: "" },
    instagram: { enabled: false, url: "" },
    tiktok: { enabled: false, url: "" },
  },
  agentSettings: {
    productDraftEnabled: true,
    supportReplyEnabled: true,
    shippingAgentEnabled: true,
    autoMoveTicketsToInProgress: true,
    defaultShippingCompanyName: "C2A LAP Delivery",
    defaultShippingStatus: "in_transit",
    productDescriptionTone: "professional",
    supportReplyTone: "friendly",
  },
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

export default function StoreSettingsSection({ settings, onSave, lang = "en" }) {
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
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
      showReviews: settings?.features?.reviewsEnabled !== false,
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
        ...blank.agentSettings,
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

  function updateAgentSettings(field, value) {
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
          reviewsEnabled: form.showReviews,
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

  return (
    <section className="panel form-panel">
      <div className="panel-head">
        <h3>{tr("Store Settings", "إعدادات المتجر")}</h3>
        <span>
          {tr(
            "Manage bilingual storefront texts, FAQ cards, social links, and agent settings.",
            "أدر نصوص المتجر باللغتين، وبطاقات الأسئلة الشائعة، وروابط التواصل، وإعدادات الإيجنت.",
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
          <input type="number" min="0" value={form.freeShippingThreshold} onChange={(event) => update("freeShippingThreshold", event.target.value)} />
        </label>
        <label>
          {tr("Low Stock Threshold", "حد المخزون المنخفض")}
          <input type="number" min="1" value={form.lowStockThreshold} onChange={(event) => update("lowStockThreshold", event.target.value)} />
        </label>
        <label className="span-2">
          {tr("Categories (comma separated)", "الفئات مفصولة بفاصلة")}
          <input
            value={form.categoriesText}
            onChange={(event) => update("categoriesText", event.target.value)}
            placeholder={tr("Gaming, Business, Student", "جيمينج، أعمال، طلاب")}
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
          labelEn="Primary CTA Label"
          labelAr="نص الزر الأساسي"
          valueEn={form.primaryCtaLabel}
          valueAr={form.primaryCtaLabelAr}
          onChangeEn={(value) => update("primaryCtaLabel", value)}
          onChangeAr={(value) => update("primaryCtaLabelAr", value)}
        />
        <BilingualField
          labelEn="Secondary CTA Label"
          labelAr="نص الزر الثانوي"
          valueEn={form.secondaryCtaLabel}
          valueAr={form.secondaryCtaLabelAr}
          onChangeEn={(value) => update("secondaryCtaLabel", value)}
          onChangeAr={(value) => update("secondaryCtaLabelAr", value)}
        />
        <BilingualField
          labelEn="Featured Section Title"
          labelAr="عنوان قسم المنتجات المميزة"
          valueEn={form.featuredTitle}
          valueAr={form.featuredTitleAr}
          onChangeEn={(value) => update("featuredTitle", value)}
          onChangeAr={(value) => update("featuredTitleAr", value)}
        />
        <BilingualField
          labelEn="Offers Section Title"
          labelAr="عنوان قسم العروض"
          valueEn={form.offersTitle}
          valueAr={form.offersTitleAr}
          onChangeEn={(value) => update("offersTitle", value)}
          onChangeAr={(value) => update("offersTitleAr", value)}
        />
        <BilingualField
          labelEn="Offers Section Subtitle"
          labelAr="وصف قسم العروض"
          valueEn={form.offersSubtitle}
          valueAr={form.offersSubtitleAr}
          onChangeEn={(value) => update("offersSubtitle", value)}
          onChangeAr={(value) => update("offersSubtitleAr", value)}
          textarea
        />
        <BilingualField
          labelEn="Brands Section Title"
          labelAr="عنوان قسم الماركات"
          valueEn={form.brandsTitle}
          valueAr={form.brandsTitleAr}
          onChangeEn={(value) => update("brandsTitle", value)}
          onChangeAr={(value) => update("brandsTitleAr", value)}
        />
        <BilingualField
          labelEn="FAQ Section Title"
          labelAr="عنوان قسم الأسئلة الشائعة"
          valueEn={form.faqTitle}
          valueAr={form.faqTitleAr}
          onChangeEn={(value) => update("faqTitle", value)}
          onChangeAr={(value) => update("faqTitleAr", value)}
        />
        <BilingualField
          labelEn="FAQ Section Subtitle"
          labelAr="وصف قسم الأسئلة الشائعة"
          valueEn={form.faqSubtitle}
          valueAr={form.faqSubtitleAr}
          onChangeEn={(value) => update("faqSubtitle", value)}
          onChangeAr={(value) => update("faqSubtitleAr", value)}
          textarea
        />

        <label className="checkbox-field span-2">
          <input type="checkbox" checked={form.showReviews} onChange={(event) => update("showReviews", event.target.checked)} />
          {tr("Show customer reviews on product pages", "إظهار تقييمات العملاء في صفحات المنتجات")}
        </label>

        <div className="span-2 section-stack">
          <div className="panel-head row-head">
            <div>
              <h3>{tr("Social Links", "روابط التواصل")}</h3>
              <span>
                {tr(
                  "Show or hide each platform and define its destination link.",
                  "أظهر أو أخفِ أي منصة، وحدد الرابط الذي سيتحول إليه العميل.",
                )}
              </span>
            </div>
          </div>
          <div className="form-grid">
            <SocialLinkEditor
              title="WhatsApp"
              titleAr="واتساب"
              icon={<WhatsAppIcon size={16} />}
              value={form.socialLinks.whatsapp}
              onToggle={(value) => updateSocial("whatsapp", "enabled", value)}
              onChangeUrl={(value) => updateSocial("whatsapp", "url", value)}
              lang={lang}
            />
            <SocialLinkEditor
              title="Facebook"
              titleAr="فيسبوك"
              icon={<FacebookIcon size={16} />}
              value={form.socialLinks.facebook}
              onToggle={(value) => updateSocial("facebook", "enabled", value)}
              onChangeUrl={(value) => updateSocial("facebook", "url", value)}
              lang={lang}
            />
            <SocialLinkEditor
              title="Instagram"
              titleAr="إنستجرام"
              icon={<InstagramIcon size={16} />}
              value={form.socialLinks.instagram}
              onToggle={(value) => updateSocial("instagram", "enabled", value)}
              onChangeUrl={(value) => updateSocial("instagram", "url", value)}
              lang={lang}
            />
            <SocialLinkEditor
              title="TikTok"
              titleAr="تيك توك"
              icon={<TikTokIcon size={16} />}
              value={form.socialLinks.tiktok}
              onToggle={(value) => updateSocial("tiktok", "enabled", value)}
              onChangeUrl={(value) => updateSocial("tiktok", "url", value)}
              lang={lang}
            />
          </div>
        </div>

        <div className="span-2 section-stack">
          <div className="panel-head row-head">
            <div>
              <h3>{tr("Agent Settings", "إعدادات الإيجنت")}</h3>
              <span>
                {tr(
                  "Control which agent tools are active and define default shipping and writing styles.",
                  "تحكم في أدوات الإيجنت المفعلة وحدد أسلوب الكتابة والإعدادات الافتراضية للشحن.",
                )}
              </span>
            </div>
          </div>
          <div className="form-grid">
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.agentSettings.productDraftEnabled}
                onChange={(event) => updateAgentSettings("productDraftEnabled", event.target.checked)}
              />
              {tr("Enable Product Agent", "تفعيل وكيل المنتجات")}
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.agentSettings.supportReplyEnabled}
                onChange={(event) => updateAgentSettings("supportReplyEnabled", event.target.checked)}
              />
              {tr("Enable Support Agent", "تفعيل وكيل الدعم")}
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.agentSettings.shippingAgentEnabled}
                onChange={(event) => updateAgentSettings("shippingAgentEnabled", event.target.checked)}
              />
              {tr("Enable Shipping Agent", "تفعيل وكيل الشحن")}
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.agentSettings.autoMoveTicketsToInProgress}
                onChange={(event) => updateAgentSettings("autoMoveTicketsToInProgress", event.target.checked)}
              />
              {tr("Auto move ticket to In Progress after generating a reply", "نقل الشكوى تلقائيًا إلى قيد التنفيذ بعد توليد الرد")}
            </label>
            <label>
              {tr("Default Shipping Company", "شركة الشحن الافتراضية")}
              <input
                value={form.agentSettings.defaultShippingCompanyName}
                onChange={(event) => updateAgentSettings("defaultShippingCompanyName", event.target.value)}
              />
            </label>
            <label>
              {tr("Default Shipping Status", "حالة الشحن الافتراضية")}
              <input
                value={form.agentSettings.defaultShippingStatus}
                onChange={(event) => updateAgentSettings("defaultShippingStatus", event.target.value)}
              />
            </label>
            <label>
              {tr("Product Description Tone", "أسلوب وصف المنتج")}
              <select
                value={form.agentSettings.productDescriptionTone}
                onChange={(event) => updateAgentSettings("productDescriptionTone", event.target.value)}
              >
                <option value="professional">{tr("Professional", "احترافي")}</option>
                <option value="premium">{tr("Premium", "فاخر")}</option>
                <option value="technical">{tr("Technical", "تقني")}</option>
              </select>
            </label>
            <label>
              {tr("Support Reply Tone", "أسلوب رد الدعم")}
              <select
                value={form.agentSettings.supportReplyTone}
                onChange={(event) => updateAgentSettings("supportReplyTone", event.target.value)}
              >
                <option value="friendly">{tr("Friendly", "ودود")}</option>
                <option value="formal">{tr("Formal", "رسمي")}</option>
                <option value="short">{tr("Short", "مختصر")}</option>
              </select>
            </label>
          </div>
        </div>

        <div className="span-2">
          <div className="panel-head row-head">
            <div>
              <h3>{tr("FAQ Cards", "بطاقات الأسئلة الشائعة")}</h3>
              <span>{tr("Each card supports English and Arabic text.", "كل بطاقة تدعم نصًا إنجليزيًا ونصًا عربيًا.")}</span>
            </div>
            <button type="button" className="secondary-btn" onClick={addFaqItem} disabled={!canAddFaq}>
              <Plus size={16} />
              {tr("Add Question", "إضافة سؤال")}
            </button>
          </div>

          <div className="section-stack">
            {visibleFaqItems.map((item, index) => (
              <div key={`${item.id}_${index}`} className="panel table-panel">
                <div className="panel-head row-head">
                  <div>
                    <h3>
                      {tr("FAQ Item", "عنصر سؤال")} #{item.id}
                    </h3>
                  </div>
                  <button
                    type="button"
                    className="secondary-btn danger-outline"
                    onClick={() => removeFaqItem(index)}
                    disabled={visibleFaqItems.length === 1}
                  >
                    <Trash2 size={14} />
                    {tr("Remove", "حذف")}
                  </button>
                </div>

                <div className="form-grid">
                  <label>
                    {tr("Number", "الترقيم")}
                    <input value={item.id} onChange={(event) => updateFaq(index, "id", event.target.value)} />
                  </label>
                  <label>
                    {tr("Question (EN)", "السؤال بالإنجليزية")}
                    <input value={item.question} onChange={(event) => updateFaq(index, "question", event.target.value)} />
                  </label>
                  <label>
                    {tr("Question (AR)", "السؤال بالعربية")}
                    <input value={item.questionAr} onChange={(event) => updateFaq(index, "questionAr", event.target.value)} dir="rtl" />
                  </label>
                  <label className="span-2">
                    {tr("Answer (EN)", "الإجابة بالإنجليزية")}
                    <textarea value={item.answer} onChange={(event) => updateFaq(index, "answer", event.target.value)} />
                  </label>
                  <label className="span-2">
                    {tr("Answer (AR)", "الإجابة بالعربية")}
                    <textarea value={item.answerAr} onChange={(event) => updateFaq(index, "answerAr", event.target.value)} dir="rtl" />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button type="submit" className="primary-btn span-2" disabled={saving}>
          <Save size={16} />
          {saving ? tr("Saving...", "جارٍ الحفظ...") : tr("Save Store Settings", "حفظ إعدادات المتجر")}
        </button>
      </form>
    </section>
  );
}
