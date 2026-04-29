import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { AnimatePresence, motion as Motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import {
  ArrowRight,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Minus,
  MoonStar,
  Plus,
  ShoppingBag,
  Star,
  Sun,
  Trash2,
  Truck,
  UserCircle2,
  X,
} from "lucide-react";
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { formatDateTime, number } from "../utils/format";
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon } from "../components/socialIcons";
import storeApi from "./storeApi";
import "./store.css";

const STORE_THEME_KEY = "c2a_store_theme_v1";
const STORE_LANG_KEY = "c2a_store_lang_v1";
const STORE_CURRENCY_KEY = "c2a_store_currency_v1";
const STORE_CART_KEY = "c2a_store_cart_v1";
const STORE_CUSTOMER_SESSION_KEY = "c2a_store_customer_session_v1";
const CURRENCY_RATES_FROM_EGP = {
  EGP: 1,
  SAR: 0.076,
  AED: 0.074,
  QAR: 0.072,
  KWD: 0.0062,
  BHD: 0.012,
  OMR: 0.0079,
};
const REGION_CURRENCY = {
  EG: "EGP",
  SA: "SAR",
  AE: "AED",
  QA: "QAR",
  KW: "KWD",
  BH: "BHD",
  OM: "OMR",
};
const TIMEZONE_CURRENCY = {
  "Africa/Cairo": "EGP",
  "Asia/Riyadh": "SAR",
  "Asia/Dubai": "AED",
  "Asia/Qatar": "QAR",
  "Asia/Kuwait": "KWD",
  "Asia/Bahrain": "BHD",
  "Asia/Muscat": "OMR",
};
const COUNTRY_OPTIONS = [
  { code: "EG", nameEn: "Egypt", nameAr: "\u0645\u0635\u0631", currency: "EGP" },
  { code: "SA", nameEn: "Saudi Arabia", nameAr: "\u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629", currency: "SAR" },
  { code: "AE", nameEn: "United Arab Emirates", nameAr: "\u0627\u0644\u0625\u0645\u0627\u0631\u0627\u062a", currency: "AED" },
  { code: "QA", nameEn: "Qatar", nameAr: "\u0642\u0637\u0631", currency: "QAR" },
  { code: "KW", nameEn: "Kuwait", nameAr: "\u0627\u0644\u0643\u0648\u064a\u062a", currency: "KWD" },
  { code: "BH", nameEn: "Bahrain", nameAr: "\u0627\u0644\u0628\u062d\u0631\u064a\u0646", currency: "BHD" },
  { code: "OM", nameEn: "Oman", nameAr: "\u0639\u0645\u0627\u0646", currency: "OMR" },
];
const StoreContext = createContext(null);
const customerApi = axios.create({ baseURL: "/api/customer-auth", timeout: 20000 });
const supportApi = axios.create({ baseURL: "/api/support", timeout: 20000 });

function createEmptyCustomerSession() {
  return { token: "", csrfToken: "", user: null };
}

function normalizeCustomerSession(rawSession) {
  if (!rawSession || typeof rawSession !== "object") {
    return createEmptyCustomerSession();
  }

  const token = typeof rawSession.token === "string" ? rawSession.token : "";
  const csrfToken = typeof rawSession.csrfToken === "string" ? rawSession.csrfToken : "";
  const user = rawSession.user && typeof rawSession.user === "object" ? rawSession.user : null;

  if (!token || !user || user.role !== "customer") {
    return createEmptyCustomerSession();
  }

  return { token, csrfToken, user };
}

function hasCustomerSession(session) {
  return Boolean(session?.token && session?.user?.role === "customer");
}

function isAuthFailure(error) {
  const status = Number(error?.response?.status || 0);
  return status === 401 || status === 403;
}

function readStoreTheme() {
  try {
    return localStorage.getItem(STORE_THEME_KEY) || "light";
  } catch {
    return "light";
  }
}

function detectBrowserRegion() {
  try {
    const lang = String(navigator.language || "");
    if (!lang) {
      return "";
    }
    if (typeof Intl.Locale === "function") {
      return new Intl.Locale(lang).region || "";
    }
    if (lang.includes("-")) {
      return lang.split("-")[1].toUpperCase();
    }
  } catch {
    // Ignore browser locale issues.
  }
  return "";
}

function detectCurrencyByEnvironment() {
  const region = detectBrowserRegion();
  if (region && REGION_CURRENCY[region]) {
    return REGION_CURRENCY[region];
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz && TIMEZONE_CURRENCY[tz]) {
      return TIMEZONE_CURRENCY[tz];
    }
  } catch {
    // Ignore timezone detection issues.
  }
  return "EGP";
}

function readStoreLanguage() {
  try {
    const stored = localStorage.getItem(STORE_LANG_KEY);
    if (stored === "ar" || stored === "en") {
      return stored;
    }
  } catch {
    // Ignore storage access issues.
  }
  try {
    return String(navigator.language || "").toLowerCase().startsWith("ar") ? "ar" : "en";
  } catch {
    return "en";
  }
}

function readStoreCurrency() {
  try {
    const stored = String(localStorage.getItem(STORE_CURRENCY_KEY) || "").toUpperCase();
    if (stored && CURRENCY_RATES_FROM_EGP[stored]) {
      return stored;
    }
  } catch {
    // Ignore storage access issues.
  }
  return detectCurrencyByEnvironment();
}

function currencyForCountry(countryCode) {
  return REGION_CURRENCY[String(countryCode || "").toUpperCase()] || "EGP";
}

function countryFromCurrency(currencyCode) {
  const code = String(currencyCode || "").toUpperCase();
  const match = COUNTRY_OPTIONS.find((country) => country.currency === code);
  return match?.code || "EG";
}

function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used inside StoreProvider.");
  }
  return context;
}

function scrollToPageTop() {
  if (typeof window === "undefined") {
    return;
  }
  window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
}

function parseStoredCart() {
  try {
    const raw = localStorage.getItem(STORE_CART_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => ({
        productId: String(item.productId || ""),
        quantity: Math.max(1, Number.parseInt(item.quantity || 1, 10) || 1),
      }))
      .filter((item) => item.productId);
  } catch {
    return [];
  }
}

function parseCustomerSession() {
  try {
    const raw = localStorage.getItem(STORE_CUSTOMER_SESSION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return normalizeCustomerSession(parsed);
  } catch {
    return createEmptyCustomerSession();
  }
}

function createPlaceholder(product, variant = 0) {
  const palettes = [
    ["#11253b", "#f97316"],
    ["#032d3c", "#10b981"],
    ["#1f2937", "#3b82f6"],
    ["#3f1d4f", "#f59e0b"],
  ];
  const [from, to] = palettes[variant % palettes.length];
  const brand = String(product.brand || "C2A LAP").replace(/&/g, "and");
  const model = String(product.laptopName || "Laptop").replace(/&/g, "and");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="860">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${from}" />
          <stop offset="100%" stop-color="${to}" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)" />
      <rect x="170" y="210" width="940" height="470" rx="36" fill="rgba(255,255,255,0.15)" />
      <text x="220" y="320" fill="white" font-size="62" font-family="Arial" font-weight="700">${brand}</text>
      <text x="220" y="390" fill="white" font-size="36" font-family="Arial">${model}</text>
      <text x="220" y="460" fill="white" font-size="30" font-family="Arial">C2A LAP Online Store</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function productImages(product) {
  if (Array.isArray(product.imageUrls) && product.imageUrls.length > 0) {
    return product.imageUrls.slice(0, 6);
  }
  return [createPlaceholder(product, 0), createPlaceholder(product, 1), createPlaceholder(product, 2)];
}

function StoreAdaptiveImage({ src, alt, className = "", profile = "default" }) {
  const [orientation, setOrientation] = useState("landscape");

  function handleLoad(event) {
    const width = Number(event.currentTarget.naturalWidth || 0);
    const height = Number(event.currentTarget.naturalHeight || 0);
    if (!width || !height) {
      return;
    }

    const ratio = width / height;
    if (ratio < 0.82) {
      setOrientation("portrait");
    } else if (ratio <= 1.15) {
      setOrientation("square");
    } else {
      setOrientation("landscape");
    }
  }

  const fitByProfile = {
    detail: "cover",
    slide: "cover",
    card: "cover",
    compact: "cover",
    default: "cover",
  };

  const scaleByProfile = {
    detail: { portrait: 1.14, square: 1.08, landscape: 1.05 },
    slide: { portrait: 1.18, square: 1.1, landscape: 1.06 },
    card: { portrait: 1.22, square: 1.12, landscape: 1.08 },
    compact: { portrait: 1.24, square: 1.14, landscape: 1.1 },
    default: { portrait: 1.16, square: 1.08, landscape: 1.04 },
  };

  const style = {
    width: "100%",
    maxWidth: "100%",
    height: "100%",
    maxHeight: "100%",
    objectFit: fitByProfile[profile] || fitByProfile.default,
    objectPosition: "center",
    display: "block",
    "--image-scale": String(scaleByProfile[profile]?.[orientation] || scaleByProfile.default[orientation] || 1),
  };

  return (
    <img
      src={src}
      alt={alt}
      className={`${className} is-${orientation}`.trim()}
      style={style}
      loading="lazy"
      onLoad={handleLoad}
    />
  );
}
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

function StoreAvatar({ name, avatarUrl, className = "store-avatar" }) {
  return (
    <span className={className} aria-hidden="true">
      {avatarUrl ? <img src={avatarUrl} alt={name || "Account avatar"} /> : <span>{getInitials(name)}</span>}
    </span>
  );
}

function StoreAvatarUploadField({
  title,
  helper,
  name,
  avatarUrl,
  isUploading,
  onUpload,
  onRemove,
  tr,
  className = "span-2",
}) {
  return (
    <div className={`store-avatar-upload ${className}`.trim()}>
      <div className="store-avatar-upload-copy">
        <strong>{title}</strong>
        {helper ? <p>{helper}</p> : null}
      </div>
      <div className="store-avatar-upload-row">
        <div className="store-avatar-preview">
          <StoreAvatar name={name} avatarUrl={avatarUrl} className="store-avatar store-avatar-lg" />
          <div>
            <strong>{name || tr("Avatar Preview", "\u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u0635\u0648\u0631\u0629")}</strong>
            <p>{avatarUrl ? tr("Image ready.", "\u062a\u0645 \u062a\u062c\u0647\u064a\u0632 \u0627\u0644\u0635\u0648\u0631\u0629.") : tr("No image selected yet.", "\u0644\u0645 \u064a\u062a\u0645 \u0627\u062e\u062a\u064a\u0627\u0631 \u0635\u0648\u0631\u0629 \u0628\u0639\u062f.")}</p>
          </div>
        </div>
        <div className="store-avatar-upload-actions">
          <label className="store-secondary-btn store-upload-label">
            {isUploading ? tr("Uploading...", "\u062c\u0627\u0631\u064d \u0627\u0644\u0631\u0641\u0639...") : tr("Upload From Device", "\u0631\u0641\u0639 \u0645\u0646 \u0627\u0644\u062c\u0647\u0627\u0632")}
            <input type="file" accept="image/*" hidden onChange={onUpload} />
          </label>
          {avatarUrl ? (
            <button type="button" className="store-danger-btn" onClick={onRemove}>
              {tr("Remove Image", "\u062d\u0630\u0641 \u0627\u0644\u0635\u0648\u0631\u0629")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function safeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function localizedText(english, arabic, isArabic, fallbackEnglish = "", fallbackArabic = "") {
  const primary = isArabic ? safeText(arabic) || safeText(english) : safeText(english) || safeText(arabic);
  if (primary) {
    return primary;
  }
  return isArabic ? safeText(fallbackArabic) || safeText(fallbackEnglish) : safeText(fallbackEnglish) || safeText(fallbackArabic);
}

function localizedContent(content, key, isArabic, fallbackEnglish = "", fallbackArabic = "") {
  return localizedText(content?.[key], content?.[`${key}Ar`], isArabic, fallbackEnglish, fallbackArabic);
}

function localizeStoreProduct(product, isArabic) {
  if (!product || typeof product !== "object") {
    return product;
  }

  return {
    ...product,
    displayName: localizedText(product.laptopName, product.laptopNameAr, isArabic),
    displayCategory: localizedText(product.category, product.categoryAr, isArabic),
    displayDescription: localizedText(product.description, product.descriptionAr, isArabic),
    displayShippingInfo: localizedText(product.shippingInfo, product.shippingInfoAr, isArabic),
    displaySpecs: {
      cpu: localizedText(product.specs?.cpu, product.specsAr?.cpu, isArabic),
      gpu: localizedText(product.specs?.gpu, product.specsAr?.gpu, isArabic),
      display: localizedText(product.specs?.display, product.specsAr?.display, isArabic),
      os: localizedText(product.specs?.os, product.specsAr?.os, isArabic),
      weight: localizedText(product.specs?.weight, product.specsAr?.weight, isArabic),
      battery: localizedText(product.specs?.battery, product.specsAr?.battery, isArabic),
    },
  };
}

function normalizeSocialUrl(platform, value) {
  const raw = safeText(value);
  if (!raw) {
    return "";
  }
  if (platform === "whatsapp") {
    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }
    const digits = raw.replace(/[^\d+]/g, "");
    return digits ? `https://wa.me/${digits.replace(/^\+/, "")}` : "";
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  return `https://${raw}`;
}

function socialPlatforms(tr) {
  return {
    whatsapp: {
      label: tr("WhatsApp", "واتساب"),
      icon: <WhatsAppIcon size={16} />,
      className: "whatsapp",
    },
    facebook: {
      label: tr("Facebook", "فيسبوك"),
      icon: <FacebookIcon size={16} />,
      className: "facebook",
    },
    instagram: {
      label: tr("Instagram", "إنستجرام"),
      icon: <InstagramIcon size={16} />,
      className: "instagram",
    },
    tiktok: {
      label: tr("TikTok", "تيك توك"),
      icon: <TikTokIcon size={16} />,
      className: "tiktok",
    },
  };
}

function computeShipping(subtotal, shippingMeta) {
  const flatRate = Number(shippingMeta?.flatRate || 0);
  const threshold = Number(shippingMeta?.freeShippingThreshold || 0);
  if (threshold > 0 && subtotal >= threshold) {
    return 0;
  }
  return flatRate;
}

function normalizeClientStoreProduct(product) {
  if (!product || typeof product !== "object") {
    return null;
  }
  const basePrice = Number(product?.price ?? product?.sellingPrice ?? 0);
  const discountPercent = Number(product?.discountPercent ?? 0);
  const serverDiscounted = Number(product?.discountedPrice ?? 0);
  const computedDiscounted = Number((basePrice * (1 - discountPercent / 100)).toFixed(2));
  const discountedPrice = serverDiscounted > 0 ? serverDiscounted : computedDiscounted;

  return {
    ...product,
    price: Number.isFinite(basePrice) ? basePrice : 0,
    discountedPrice: Number.isFinite(discountedPrice) ? discountedPrice : 0,
  };
}

function StoreProvider({ children }) {
  const [theme, setTheme] = useState(() => readStoreTheme());
  const [language, setLanguage] = useState(() => readStoreLanguage());
  const [currency, setCurrency] = useState(() => readStoreCurrency());
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cart, setCart] = useState(() => parseStoredCart());
  const [customerSession, setCustomerSession] = useState(() => parseCustomerSession());
  const [supportTickets, setSupportTickets] = useState([]);
  const [supportStats, setSupportStats] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [customerOrderStats, setCustomerOrderStats] = useState(null);
  const [checkoutDraft, setCheckoutDraft] = useState({
    customer: null,
    paymentMethod: "cash_on_delivery",
    paymentReference: "",
  });
  const isArabic = language === "ar";

  useEffect(() => {
    try {
      localStorage.setItem(STORE_THEME_KEY, theme);
    } catch {
      // Ignore storage write issues.
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = isArabic ? "ar" : "en";
    document.documentElement.dir = isArabic ? "rtl" : "ltr";
    try {
      localStorage.setItem(STORE_LANG_KEY, language);
    } catch {
      // Ignore storage write issues.
    }
  }, [isArabic, language]);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_CURRENCY_KEY, currency);
    } catch {
      // Ignore storage write issues.
    }
  }, [currency]);

  useEffect(() => {
    const customerCountry = String(customerSession?.user?.country || "").toUpperCase();
    if (!customerCountry) {
      return;
    }
    const nextCurrency = currencyForCountry(customerCountry);
    if (nextCurrency && nextCurrency !== currency) {
      setCurrency(nextCurrency);
    }
  }, [currency, customerSession?.user?.country]);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_CART_KEY, JSON.stringify(cart));
    } catch {
      // Ignore storage write issues.
    }
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_CUSTOMER_SESSION_KEY, JSON.stringify(customerSession));
    } catch {
      // Ignore storage write issues.
    }
  }, [customerSession]);

  function resetCustomerSession() {
    setCustomerSession(createEmptyCustomerSession());
    setSupportTickets([]);
    setSupportStats(null);
    setCustomerOrders([]);
    setCustomerOrderStats(null);
  }

  function customerHeaders() {
    if (!hasCustomerSession(customerSession)) {
      return {};
    }
    const headers = {
      Authorization: `Bearer ${customerSession.token}`,
    };
    if (customerSession.csrfToken) {
      headers["X-CSRF-Token"] = customerSession.csrfToken;
    }
    return headers;
  }

  const formatPrice = useMemo(() => {
    const rate = Number(CURRENCY_RATES_FROM_EGP[currency] || 1);
    const locale = isArabic ? "ar-EG" : "en-US";
    const formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    });
    return (value) => {
      const amount = Number(value || 0);
      const converted = Number.isFinite(amount) ? amount * rate : 0;
      return formatter.format(converted);
    };
  }, [currency, isArabic]);

  function tr(english, arabic) {
    return isArabic ? arabic : english;
  }

  useEffect(() => {
    setCart((prev) =>
      prev
        .map((line) => {
          const product = products.find((item) => item.id === line.productId);
          if (!product) {
            return null;
          }
          const maxQuantity = Math.max(1, Number(product.stock || 0));
          if (maxQuantity <= 0) {
            return null;
          }
          return {
            ...line,
            quantity: Math.min(line.quantity, maxQuantity),
          };
        })
        .filter(Boolean),
    );
  }, [products]);

  useEffect(() => {
    if (!hasCustomerSession(customerSession)) {
      setSupportTickets([]);
      setSupportStats(null);
      setCustomerOrders([]);
      setCustomerOrderStats(null);
      return;
    }
    void refreshCustomerProfile().catch(() => {});
    void refreshSupportTickets().catch(() => {});
    void refreshCustomerOrders().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerSession?.token, customerSession?.user?.role]);

  async function refreshStore() {
    setLoading(true);
    setError("");
    try {
      const [metaResponse, productsResponse] = await Promise.all([
        storeApi.get("/meta"),
        storeApi.get("/products", { params: { sort: "featured" } }),
      ]);
      setMeta(metaResponse.data);
      setProducts((productsResponse.data?.products || []).map(normalizeClientStoreProduct));
    } catch (requestError) {
      const message = requestError?.response?.data?.error || requestError?.message || "Store is unavailable.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshStore();
  }, []);

  async function registerCustomer(payload) {
    const response = await customerApi.post("/register", payload);
    setCustomerSession(normalizeCustomerSession({
      token: response.data.token,
      csrfToken: response.data.csrfToken || "",
      user: response.data.user,
    }));
    return response.data.user;
  }

  async function loginCustomer(payload) {
    const response = await customerApi.post("/login", payload);
    setCustomerSession(normalizeCustomerSession({
      token: response.data.token,
      csrfToken: response.data.csrfToken || "",
      user: response.data.user,
    }));
    return response.data.user;
  }

  async function applySocialSession(token, csrfToken = "") {
    const response = await customerApi.get("/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    setCustomerSession(normalizeCustomerSession({
      token,
      csrfToken,
      user: response.data.user,
    }));
    return response.data.user;
  }

  async function refreshCustomerProfile() {
    if (!hasCustomerSession(customerSession)) {
      return null;
    }
    try {
      const response = await customerApi.get("/me", {
        headers: customerHeaders(),
      });
      setCustomerSession((prev) =>
        normalizeCustomerSession({
          ...prev,
          user: response.data.user,
        }),
      );
      return response.data.user;
    } catch (error) {
      if (isAuthFailure(error)) {
        resetCustomerSession();
        return null;
      }
      throw error;
    }
  }

  async function updateCustomerProfile(payload) {
    if (!hasCustomerSession(customerSession)) {
      throw new Error("Login is required to update profile.");
    }
    const response = await customerApi.put("/profile", payload, {
      headers: customerHeaders(),
    });
    setCustomerSession((prev) =>
      normalizeCustomerSession({
        ...prev,
        user: response.data.user,
      }),
    );
    return response.data.user;
  }

  async function uploadCustomerAvatar(file) {
    const formData = new FormData();
    formData.append("avatar", file);
    const response = await customerApi.post("/avatar-upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data?.avatarUrl || "";
  }

  async function changeCustomerPassword(payload) {
    if (!hasCustomerSession(customerSession)) {
      throw new Error("Login is required to change password.");
    }
    await customerApi.put("/password", payload, {
      headers: customerHeaders(),
    });
  }

  async function loginWithGoogleIdToken(idToken) {
    const response = await customerApi.post("/social/google", { idToken });
    setCustomerSession(normalizeCustomerSession({
      token: response.data.token,
      csrfToken: response.data.csrfToken || "",
      user: response.data.user,
    }));
    return response.data.user;
  }

  async function loginWithFacebookAccessToken(accessToken) {
    const response = await customerApi.post("/social/facebook", { accessToken });
    setCustomerSession(normalizeCustomerSession({
      token: response.data.token,
      csrfToken: response.data.csrfToken || "",
      user: response.data.user,
    }));
    return response.data.user;
  }

  function logoutCustomer() {
    resetCustomerSession();
  }

  async function createSupportTicket(payload) {
    const response = await supportApi.post("/tickets", payload, {
      headers: customerHeaders(),
    });
    if (customerSession?.token) {
      await refreshSupportTickets();
    }
    return response.data.ticket;
  }

  async function refreshSupportTickets() {
    if (!hasCustomerSession(customerSession)) {
      setSupportTickets([]);
      setSupportStats(null);
      return;
    }
    try {
      const response = await supportApi.get("/tickets", {
        headers: customerHeaders(),
      });
      setSupportTickets(response.data.tickets || []);
      setSupportStats(response.data.stats || null);
    } catch (error) {
      if (isAuthFailure(error)) {
        resetCustomerSession();
        return;
      }
      throw error;
    }
  }

  async function refreshCustomerOrders() {
    if (!hasCustomerSession(customerSession)) {
      setCustomerOrders([]);
      setCustomerOrderStats(null);
      return;
    }
    try {
      const response = await customerApi.get("/orders", {
        headers: customerHeaders(),
      });
      setCustomerOrders(response.data.orders || []);
      setCustomerOrderStats(response.data.stats || null);
    } catch (error) {
      if (isAuthFailure(error)) {
        resetCustomerSession();
        return;
      }
      throw error;
    }
  }

  async function replyToSupportTicket(ticketId, message) {
    if (!hasCustomerSession(customerSession)) {
      throw new Error("Login is required to reply to support ticket.");
    }
    await supportApi.post(
      `/tickets/${ticketId}/messages`,
      { message },
      {
        headers: customerHeaders(),
      },
    );
    await refreshSupportTickets();
  }

  async function addProductReview(productId, payload) {
    if (!hasCustomerSession(customerSession)) {
      throw new Error("Please login before adding a review.");
    }
    await storeApi.post(`/products/${productId}/reviews`, payload, {
      headers: customerHeaders(),
    });
    await refreshStore();
  }

  function addToCart(productId, quantity = 1) {
    const product = products.find((item) => item.id === productId);
    if (!product) {
      return;
    }
    const localizedProduct = localizeStoreProduct(product, isArabic);
    if (Number(product.stock || 0) <= 0) {
      toast.error(tr("This laptop is currently out of stock.", "هذا اللابتوب غير متوفر حاليًا."));
      return;
    }

    setCart((prev) => {
      const index = prev.findIndex((item) => item.productId === productId);
      if (index < 0) {
        return [...prev, { productId, quantity: Math.min(quantity, Number(product.stock || 1)) }];
      }
      const next = [...prev];
      const requested = next[index].quantity + quantity;
      next[index] = {
        ...next[index],
        quantity: Math.min(Math.max(1, requested), Number(product.stock || requested)),
      };
      return next;
    });
    toast.success(
      tr(
        `${localizedProduct.displayName} added to cart.`,
        `تمت إضافة ${localizedProduct.displayName} إلى السلة.`,
      ),
    );
  }

  function removeFromCart(productId) {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }

  function updateQuantity(productId, quantity) {
    const normalizedQuantity = Number.parseInt(quantity, 10);
    if (!Number.isInteger(normalizedQuantity) || normalizedQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const product = products.find((item) => item.id === productId);
    const maxQuantity = Math.max(1, Number(product?.stock || normalizedQuantity));
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, quantity: Math.min(Math.max(1, normalizedQuantity), maxQuantity) }
          : item,
      ),
    );
  }

  function clearCart() {
    setCart([]);
  }

  function saveCheckoutDraft(payload) {
    setCheckoutDraft((prev) => ({
      ...prev,
      ...payload,
    }));
  }

  async function placeOrder({ customer, paymentMethod, paymentReference }) {
    if (!hasCustomerSession(customerSession)) {
      throw new Error("Please login before placing an order.");
    }
    const response = await storeApi.post(
      "/checkout",
      {
        currency,
        paymentMethod,
        paymentReference,
        customer,
        items: cartItems.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
        })),
      },
      {
        headers: customerHeaders(),
      },
    );
    const order = response.data?.order;
    clearCart();
    await refreshStore();
    await refreshCustomerProfile();
    await refreshCustomerOrders();
    return order;
  }

  const cartItems = useMemo(
    () =>
      cart
        .map((line) => {
          const product = products.find((item) => item.id === line.productId);
          if (!product) {
            return null;
          }
          return {
            ...product,
            quantity: line.quantity,
            lineTotal: Number((line.quantity * Number(product.discountedPrice || 0)).toFixed(2)),
          };
        })
        .filter(Boolean),
    [cart, products],
  );

  const subtotal = useMemo(
    () => Number(cartItems.reduce((sum, line) => sum + Number(line.lineTotal || 0), 0).toFixed(2)),
    [cartItems],
  );
  const shippingCost = useMemo(() => computeShipping(subtotal, meta?.shipping), [meta?.shipping, subtotal]);
  const total = useMemo(() => Number((subtotal + shippingCost).toFixed(2)), [shippingCost, subtotal]);
  const cartCount = useMemo(
    () => cartItems.reduce((sum, line) => sum + Number(line.quantity || 0), 0),
    [cartItems],
  );

  const value = {
    theme,
    setTheme,
    language,
    isArabic,
    setLanguage,
    currency,
    setCurrency,
    formatPrice,
    tr,
    products,
    meta,
    loading,
    error,
    refreshStore,
    cart,
    cartItems,
    cartCount,
    subtotal,
    shippingCost,
    total,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    saveCheckoutDraft,
    placeOrder,
    checkoutDraft,
    customerSession,
    customerUser: customerSession?.user || null,
    isCustomerAuthenticated: hasCustomerSession(customerSession),
    registerCustomer,
    loginCustomer,
    loginWithGoogleIdToken,
    loginWithFacebookAccessToken,
    applySocialSession,
    refreshCustomerProfile,
    updateCustomerProfile,
    uploadCustomerAvatar,
    changeCustomerPassword,
    logoutCustomer,
    createSupportTicket,
    refreshSupportTickets,
    replyToSupportTicket,
    supportTickets,
    supportStats,
    customerOrders,
    customerOrderStats,
    refreshCustomerOrders,
    addProductReview,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function StoreHeader() {
  const {
    theme,
    setTheme,
    language,
    setLanguage,
    currency,
    setCurrency,
    cartCount,
    customerUser,
    isCustomerAuthenticated,
    logoutCustomer,
    tr,
  } = useStore();

  return (
    <header className="store-header">
      <div className="store-brand">
        <Link to="/store">
          <span>C2A LAP</span>
          <strong>{tr("Online Store", "\u0627\u0644\u0645\u062a\u062c\u0631 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a")}</strong>
        </Link>
      </div>

      <nav className="store-nav">
        <NavLink to="/store" end>
          {tr("Home", "\u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629")}
        </NavLink>
        <NavLink to="/store/products">{tr("Products", "\u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a")}</NavLink>
        <NavLink to="/store/cart">
          {tr("Cart", "\u0627\u0644\u0633\u0644\u0629")}
          <span>{number.format(cartCount)}</span>
        </NavLink>
        <NavLink to="/store/support">{tr("Support", "\u0627\u0644\u062f\u0639\u0645")}</NavLink>
        <NavLink to="/store/account">{tr("Account", "\u062d\u0633\u0627\u0628\u064a")}</NavLink>
      </nav>

      <div className="store-header-actions">
        <select
          className="store-select-mini"
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          aria-label="Language"
        >
          <option value="en">EN</option>
          <option value="ar">AR</option>
        </select>
        <select
          className="store-select-mini"
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
          aria-label="Currency"
        >
          {Object.keys(CURRENCY_RATES_FROM_EGP).map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
        {isCustomerAuthenticated ? (
          <>
            <Link to="/store/account" className="store-account-chip">
              <StoreAvatar name={customerUser?.name} avatarUrl={customerUser?.avatarUrl} />
              <span>{customerUser?.name || tr("Customer", "\u0627\u0644\u0639\u0645\u064a\u0644")}</span>
            </Link>
            <button type="button" className="store-icon-btn" onClick={logoutCustomer} aria-label="Logout">
              <LogOut size={16} />
            </button>
          </>
        ) : (
          <Link to="/store/account" className="store-secondary-btn">
            <UserCircle2 size={14} />
            {tr("Login", "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644")}
          </Link>
        )}
        <button
          type="button"
          className="store-icon-btn"
          onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun size={16} /> : <MoonStar size={16} />}
        </button>
      </div>
    </header>
  );
}

function StoreScrollManager() {
  const location = useLocation();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [location.pathname, location.search]);

  return null;
}

function StoreSocialButtons({ socialLinks, tr, compact = false }) {
  const links = socialLinks && typeof socialLinks === "object" ? socialLinks : {};
  const platforms = socialPlatforms(tr);
  const visibleItems = Object.entries(platforms)
    .map(([key, meta]) => {
      const item = links[key];
      const url = normalizeSocialUrl(key, item?.url);
      if (!item?.enabled || !url) {
        return null;
      }
      return {
        key,
        url,
        label: meta.label,
        icon: meta.icon,
        className: meta.className,
      };
    })
    .filter(Boolean);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <div className={`store-social-links${compact ? " compact" : ""}`}>
      {visibleItems.map((item) => (
        <a
          key={item.key}
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className={`store-social-link ${item.className}`}
        >
          <span className="store-social-icon">{item.icon}</span>
          <span>{item.label}</span>
        </a>
      ))}
    </div>
  );
}

function StoreLayout() {
  const { tr, meta } = useStore();
  return (
    <>
      <StoreScrollManager />
      <StoreHeader />
      <main className="store-main">
        <Outlet />
      </main>
      <footer className="store-footer">
        <StoreSocialButtons socialLinks={meta?.socialLinks} tr={tr} compact />
        <p>{tr("C2A LAP Online Store - Premium laptops with secure checkout and live stock.", "C2A LAP - \u0645\u062a\u062c\u0631 \u0644\u0627\u0628\u062a\u0648\u0628\u0627\u062a \u0628\u062f\u0641\u0639 \u0622\u0645\u0646 \u0648\u0645\u062e\u0632\u0648\u0646 \u062d\u064a.")}</p>
        <small>
          {tr(
            "Developed by Mohamed Diaa El Deen Samy as a freelance engineer. This proprietary website is built exclusively for C2A LAP.",
            "تم تطوير هذا الموقع بواسطة محمد ضياء الددين سامي كفري لنسر، وهو موقع مملوك ومخصص حصريًا لشركة C2A LAP.",
          )}
        </small>
      </footer>
    </>
  );
}

function ProductCard({ product, onAddToCart }) {
  const { formatPrice, tr, isArabic } = useStore();
  const localizedProduct = localizeStoreProduct(product, isArabic);
  const image = productImages(product)[0];
  return (
    <Motion.article
      className="store-product-card"
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
    >
      <Link to={`/store/products/${product.id}`} className="store-product-image-link" onClick={scrollToPageTop}>
        <StoreAdaptiveImage src={image} alt={localizedProduct.displayName} className="store-product-image" profile="card" />
      </Link>

      <div className="store-product-content">
        <div className="store-product-summary">
          <p className="store-product-brand">{product.brand}</p>
          <h3 className="store-product-title">
            <Link to={`/store/products/${product.id}`} onClick={scrollToPageTop}>
              {localizedProduct.displayName}
            </Link>
          </h3>
          {localizedProduct.displayCategory ? <p className="store-product-category">{localizedProduct.displayCategory}</p> : null}
          <p className="store-product-specs">
            {product.ram} RAM | {product.storage}
          </p>
        </div>

        <div className="store-product-price">
          {product.discountPercent > 0 ? (
            <>
              <span className="new">{formatPrice(Number(product.discountedPrice || 0))}</span>
              <span className="old">{formatPrice(Number(product.price || 0))}</span>
            </>
          ) : (
            <span className="new">{formatPrice(Number(product.price || 0))}</span>
          )}
          {product.discountPercent > 0 ? (
            <span className="discount-badge">-{product.discountPercent}%</span>
          ) : null}
        </div>

        <div className="store-product-footer">
          <span className={product.stock > 0 ? "stock in" : "stock out"}>
            {product.stock > 0
              ? tr(`In Stock (${product.stock})`, `\u0645\u062a\u0648\u0641\u0631 (${product.stock})`)
              : tr("Out of Stock", "\u063a\u064a\u0631 \u0645\u062a\u0648\u0641\u0631")}
          </span>
          <button
            type="button"
            className="store-primary-btn"
            onClick={() => onAddToCart(product.id)}
            disabled={product.stock <= 0}
          >
            <ShoppingBag size={16} />
            {tr("Add", "\u0627\u0636\u0641")}
          </button>
        </div>
      </div>
    </Motion.article>
  );
}

function RequireCustomerAccount({ children }) {
  const { isCustomerAuthenticated, tr } = useStore();
  const location = useLocation();

  useEffect(() => {
    if (!isCustomerAuthenticated) {
      toast.error(
        tr(
          "Please login before continuing to checkout.",
          "\u064a\u0631\u062c\u0649 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0642\u0628\u0644 \u0627\u0644\u0645\u062a\u0627\u0628\u0639\u0629 \u0625\u0644\u0649 \u0627\u0644\u062f\u0641\u0639.",
        ),
      );
    }
  }, [isCustomerAuthenticated, tr]);

  if (!isCustomerAuthenticated) {
    return <Navigate to="/store/account" replace state={{ from: location.pathname }} />;
  }

  return children;
}

function StoreHomePage() {
  const { products, meta, addToCart, loading, error, tr, formatPrice, isArabic } = useStore();
  const featured = useMemo(() => products.filter((product) => product.featured).slice(0, 6), [products]);
  const offers = useMemo(
    () => products.filter((product) => product.discountPercent > 0 || product.bestOffer).slice(0, 4),
    [products],
  );
  const brands = useMemo(
    () => [...new Set(products.map((product) => product.brand).filter(Boolean))].slice(0, 12),
    [products],
  );

  const content = meta?.content || {};
  const faqItems = useMemo(() => {
    if (Array.isArray(content.faqItems) && content.faqItems.length > 0) {
      return content.faqItems;
    }
    return [
      {
        id: "01",
        question: tr("Do you offer installment plans?", "\u0647\u0644 \u062a\u0648\u0641\u0631\u0648\u0646 \u0623\u0646\u0638\u0645\u0629 \u062a\u0642\u0633\u064a\u0637\u061f"),
        answer: tr(
          "Yes. Flexible installment options are available through supported payment providers.",
          "\u0646\u0639\u0645\u060c \u0646\u0648\u0641\u0631 \u062e\u064a\u0627\u0631\u0627\u062a \u062a\u0642\u0633\u064a\u0637 \u0645\u0631\u0646\u0629 \u0639\u0628\u0631 \u0648\u0633\u0627\u0626\u0644 \u0627\u0644\u062f\u0641\u0639 \u0627\u0644\u0645\u062f\u0639\u0648\u0645\u0629 \u062f\u0627\u062e\u0644 \u0627\u0644\u0645\u062a\u062c\u0631.",
        ),
      },
      {
        id: "02",
        question: tr("Do you have a showroom?", "\u0647\u0644 \u0644\u062f\u064a\u0643\u0645 \u0645\u0642\u0631 \u0641\u0639\u0644\u064a\u061f"),
        answer: tr(
          "We operate online and coordinate customer service and order support through our team.",
          "\u0646\u062d\u0646 \u0646\u0639\u0645\u0644 \u0623\u0648\u0646\u0644\u0627\u064a\u0646 \u0648\u0646\u0646\u0633\u0642 \u062e\u062f\u0645\u0629 \u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u0648\u0645\u062a\u0627\u0628\u0639\u0629 \u0627\u0644\u0637\u0644\u0628\u0627\u062a \u0639\u0628\u0631 \u0641\u0631\u064a\u0642\u0646\u0627.",
        ),
      },
      {
        id: "03",
        question: tr("What about warranty?", "\u0645\u0627\u0630\u0627 \u0639\u0646 \u0627\u0644\u0636\u0645\u0627\u0646\u061f"),
        answer: tr(
          "Warranty coverage depends on the product page and order status updates.",
          "\u062a\u063a\u0637\u064a\u0629 \u0627\u0644\u0636\u0645\u0627\u0646 \u062a\u0639\u062a\u0645\u062f \u0639\u0644\u0649 \u0635\u0641\u062d\u0629 \u0627\u0644\u0645\u0646\u062a\u062c \u0648\u062a\u062d\u062f\u064a\u062b\u0627\u062a \u062d\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628.",
        ),
      },
      {
        id: "04",
        question: tr("How long does delivery take?", "\u0643\u0645 \u062a\u0633\u062a\u063a\u0631\u0642 \u0645\u062f\u0629 \u0627\u0644\u062a\u0648\u0635\u064a\u0644\u061f"),
        answer: tr(
          "Delivery time depends on city and shipping company and is shown during checkout.",
          "\u0645\u062f\u0629 \u0627\u0644\u062a\u0648\u0635\u064a\u0644 \u062a\u062e\u062a\u0644\u0641 \u062d\u0633\u0628 \u0627\u0644\u0645\u062f\u064a\u0646\u0629 \u0648\u0634\u0631\u0643\u0629 \u0627\u0644\u0634\u062d\u0646\u060c \u0648\u062a\u0638\u0647\u0631 \u0644\u0643 \u0623\u062b\u0646\u0627\u0621 \u0625\u062a\u0645\u0627\u0645 \u0627\u0644\u0637\u0644\u0628.",
        ),
      },
    ];
  }, [content.faqItems, isArabic]);

  const slides = featured.length > 0 ? featured.slice(0, 3) : products.slice(0, 3);
  const spotlight = featured[0] || products[0] || null;
  const featuredList = (featured.length > 1 ? featured.slice(1, 5) : products.slice(1, 5)).filter(Boolean);
  const localizedSlides = useMemo(() => slides.map((item) => localizeStoreProduct(item, isArabic)), [slides, isArabic]);
  const localizedSpotlight = useMemo(() => localizeStoreProduct(spotlight, isArabic), [spotlight, isArabic]);
  const localizedFeaturedList = useMemo(
    () => featuredList.map((item) => localizeStoreProduct(item, isArabic)),
    [featuredList, isArabic],
  );
  const localizedOffers = useMemo(() => offers.map((item) => localizeStoreProduct(item, isArabic)), [offers, isArabic]);
  const localizedFaqItems = useMemo(
    () => faqItems.map((item) => ({
      ...item,
      questionLabel: localizedText(item.question, item.questionAr, isArabic),
      answerLabel: localizedText(item.answer, item.answerAr, isArabic),
    })),
    [faqItems, isArabic],
  );
  const [activeSlide, setActiveSlide] = useState(0);
  const [openFaqItems, setOpenFaqItems] = useState(() => new Set(["01"]));

  useEffect(() => {
    if (slides.length <= 1) {
      return undefined;
    }
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [slides.length]);

  const faqResetKey = useMemo(
    () => `${isArabic ? "ar" : "en"}:${faqItems.map((item) => item.id).join("|")}`,
    [faqItems, isArabic],
  );

  useEffect(() => {
    setOpenFaqItems(new Set([faqItems[0]?.id || "01"]));
  }, [faqResetKey]);

  function toggleFaq(itemId) {
    setOpenFaqItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  return (
    <div className="store-stack">
      <section className="store-hero">
        <div className="store-hero-text">
          <p className="store-eyebrow">
            {localizedContent(content, "heroBadge", isArabic, "C2A LAP E-commerce", "\u0645\u062a\u062c\u0631 C2A LAP")}
          </p>
          <h1>
            {localizedContent(
              content,
              "heroTitle",
              isArabic,
              "Premium laptops, synchronized with real-time inventory.",
              "\u0644\u0627\u0628\u062a\u0648\u0628\u0627\u062a \u0627\u062d\u062a\u0631\u0627\u0641\u064a\u0629 \u0645\u0631\u062a\u0628\u0637\u0629 \u0628\u0627\u0644\u0645\u062e\u0632\u0648\u0646 \u0644\u062d\u0638\u064a\u064b\u0627.",
            )}
          </h1>
          <p>
            {localizedContent(
              content,
              "heroSubtitle",
              isArabic,
              "Browse powerful devices, place orders instantly, and track every purchase through secure checkout.",
              "\u062a\u0635\u0641\u062d \u0623\u062c\u0647\u0632\u0629 \u0642\u0648\u064a\u0629 \u0648\u0627\u0637\u0644\u0628 \u0645\u0628\u0627\u0634\u0631\u0629 \u0648\u062a\u0627\u0628\u0639 \u0643\u0644 \u0639\u0645\u0644\u064a\u0629 \u0634\u0631\u0627\u0621 \u0645\u0646 \u062e\u0644\u0627\u0644 \u062a\u062c\u0631\u0628\u0629 \u062f\u0641\u0639 \u0622\u0645\u0646\u0629.",
            )}
          </p>
          <div className="store-hero-actions">
            <Link className="store-primary-btn" to="/store/products">
              {localizedContent(content, "primaryCtaLabel", isArabic, "Shop Laptops", "\u062a\u0633\u0648\u0642 \u0627\u0644\u0644\u0627\u0628\u062a\u0648\u0628\u0627\u062a")}
              <ArrowRight size={16} />
            </Link>
            <Link className="store-secondary-btn" to="/store/cart">
              {localizedContent(content, "secondaryCtaLabel", isArabic, "Go To Cart", "\u0627\u0630\u0647\u0628 \u0625\u0644\u0649 \u0627\u0644\u0633\u0644\u0629")}
            </Link>
          </div>
          <StoreSocialButtons socialLinks={meta?.socialLinks} tr={tr} />
        </div>

        <div className="store-hero-slider">
          {slides.length === 0 ? (
            <div className="store-hero-empty">
              {loading
                ? tr("Loading catalog...", "\u062c\u0627\u0631\u064a \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a...")
                : tr("No products available.", "\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0646\u062a\u062c\u0627\u062a \u062d\u0627\u0644\u064a\u064b\u0627.")}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <Motion.div
                key={slides[activeSlide]?.id || activeSlide}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.35 }}
              >
                <Link
                  to={`/store/products/${localizedSlides[activeSlide].id}`}
                  className="store-slide-card store-slide-card-link"
                  onClick={scrollToPageTop}
                >
                  <StoreAdaptiveImage
                    src={productImages(localizedSlides[activeSlide])[0]}
                    alt={localizedSlides[activeSlide].displayName}
                    profile="slide"
                  />
                  <div>
                    <p>{localizedSlides[activeSlide].brand}</p>
                    <h3>{localizedSlides[activeSlide].displayName}</h3>
                    <span>{formatPrice(Number(localizedSlides[activeSlide].discountedPrice || 0))}</span>
                  </div>
                </Link>
              </Motion.div>
            </AnimatePresence>
          )}
          {slides.length > 1 ? (
            <div className="store-slide-controls">
              <button
                type="button"
                className="store-icon-btn"
                onClick={() => setActiveSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1))}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className="store-icon-btn"
                onClick={() => setActiveSlide((prev) => (prev + 1) % slides.length)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {error ? <section className="store-error">{error}</section> : null}

      <section className="store-brands">
        <div className="store-brands-head">
          <div>
            <p className="store-eyebrow">{tr("Shop By Brand", "\u062a\u0633\u0648\u0642 \u062d\u0633\u0628 \u0627\u0644\u0639\u0644\u0627\u0645\u0629 \u0627\u0644\u062a\u062c\u0627\u0631\u064a\u0629")}</p>
            <h3>{localizedContent(content, "brandsTitle", isArabic, "Popular Brands", "\u0623\u0634\u0647\u0631 \u0627\u0644\u0645\u0627\u0631\u0643\u0627\u062a")}</h3>
          </div>
          <Link to="/store/products" className="store-link-inline">
            {tr("View all", "\u0639\u0631\u0636 \u0627\u0644\u0643\u0644")}
            <ArrowRight size={14} />
          </Link>
        </div>
        <div className="store-brand-showcase">
          {brands.slice(0, 6).map((brand, index) => (
            <Motion.div
              key={brand}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.28, delay: index * 0.04 }}
            >
              <Link to={`/store/products?brand=${encodeURIComponent(brand)}`} className="store-brand-card" onClick={scrollToPageTop}>
                <span className="store-brand-logo">{brand}</span>
              </Link>
            </Motion.div>
          ))}
        </div>
      </section>

      <section className="store-home-metrics">
        <Motion.article initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <strong>{products.length}</strong>
          <span>{tr("Available Models", "\u0627\u0644\u0645\u0648\u062f\u064a\u0644\u0627\u062a \u0627\u0644\u0645\u062a\u0627\u062d\u0629")}</span>
        </Motion.article>
        <Motion.article
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
        >
          <strong>{brands.length}</strong>
          <span>{tr("Popular Brands", "\u0627\u0644\u0639\u0644\u0627\u0645\u0627\u062a \u0627\u0644\u0634\u0627\u0626\u0639\u0629")}</span>
        </Motion.article>
        <Motion.article
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          <strong>{offers.length}</strong>
          <span>{tr("Live Offers", "\u0627\u0644\u0639\u0631\u0648\u0636 \u0627\u0644\u062d\u0627\u0644\u064a\u0629")}</span>
        </Motion.article>
      </section>

      <section className="store-section">
        <div className="store-section-head">
          <h2>{localizedContent(content, "featuredTitle", isArabic, "Featured Laptops", "\u0645\u0646\u062a\u062c\u0627\u062a \u0645\u0645\u064a\u0632\u0629")}</h2>
          <Link to="/store/products">
            {tr("View all", "\u0639\u0631\u0636 \u0627\u0644\u0643\u0644")}
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="store-home-featured-layout">
          {localizedSpotlight ? (
            <article className="store-spotlight-card">
              <StoreAdaptiveImage src={productImages(localizedSpotlight)[0]} alt={localizedSpotlight.displayName} profile="card" />
              <div className="store-spotlight-content">
                <p className="store-eyebrow">{localizedSpotlight.brand}</p>
                <h3>{localizedSpotlight.displayName}</h3>
                <p>
                  {localizedSpotlight.displayDescription || tr(
                    "Premium laptop ready for work, study, and gaming.",
                    "\u0644\u0627\u0628\u062a\u0648\u0628 \u0627\u062d\u062a\u0631\u0627\u0641\u064a \u062c\u0627\u0647\u0632 \u0644\u0644\u0639\u0645\u0644 \u0648\u0627\u0644\u062f\u0631\u0627\u0633\u0629 \u0648\u0627\u0644\u0623\u0644\u0639\u0627\u0628.",
                  )}
                </p>
                <div className="store-hero-actions">
                  <Link to={`/store/products/${localizedSpotlight.id}`} className="store-primary-btn" onClick={scrollToPageTop}>
                    {tr("Open Details", "\u0641\u062a\u062d \u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644")}
                  </Link>
                  <button type="button" className="store-secondary-btn" onClick={() => addToCart(localizedSpotlight.id)}>
                    {tr("Add To Cart", "\u0623\u0636\u0641 \u0625\u0644\u0649 \u0627\u0644\u0633\u0644\u0629")}
                  </button>
                </div>
              </div>
            </article>
          ) : null}

          <div className="store-home-featured-list">
            {localizedFeaturedList.map((product) => (
              <Link key={product.id} to={`/store/products/${product.id}`} className="store-featured-mini-card" onClick={scrollToPageTop}>
                <StoreAdaptiveImage src={productImages(product)[0]} alt={product.displayName} profile="compact" />
                <div>
                  <strong>{product.displayName}</strong>
                  <span>{product.brand}</span>
                  <em>{formatPrice(Number(product.discountedPrice || 0))}</em>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="store-section offers">
        <div className="store-section-head">
          <h2>{localizedContent(content, "offersTitle", isArabic, "Best Offers", "\u0623\u0641\u0636\u0644 \u0627\u0644\u0639\u0631\u0648\u0636")}</h2>
          <p>
            {localizedContent(
              content,
              "offersSubtitle",
              isArabic,
              "Hand-picked discounted devices with instant checkout.",
              "\u0623\u062c\u0647\u0632\u0629 \u0645\u062e\u0641\u0636\u0629 \u0645\u062e\u062a\u0627\u0631\u0629 \u0645\u0639 \u0634\u0631\u0627\u0621 \u0633\u0631\u064a\u0639 \u0648\u0622\u0645\u0646.",
            )}
          </p>
        </div>
        <div className="store-offer-strip">
          {localizedOffers.map((product) => (
            <article key={product.id} className="store-offer-card">
              <StoreAdaptiveImage src={productImages(product)[0]} alt={product.displayName} profile="card" />
              <div>
                <p>{product.brand}</p>
                <h3>{product.displayName}</h3>
                <span>{formatPrice(Number(product.discountedPrice || 0))}</span>
              </div>
              <div className="store-hero-actions">
                <Link to={`/store/products/${product.id}`} className="store-secondary-btn" onClick={scrollToPageTop}>
                  {tr("View", "\u0639\u0631\u0636")}
                </Link>
                <button type="button" className="store-primary-btn" onClick={() => addToCart(product.id)}>
                  {tr("Add", "\u0623\u0636\u0641")}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="store-faq">
        <div className="store-brands-head">
          <div>
            <p className="store-eyebrow">{tr("FAQ", "\u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u0634\u0627\u0626\u0639\u0629")}</p>
            <h3>{localizedContent(content, "faqTitle", isArabic, "Frequently Asked Questions", "\u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u0634\u0627\u0626\u0639\u0629")}</h3>
            <span>
              {localizedContent(
                content,
                "faqSubtitle",
                isArabic,
                "Answers for the most common customer questions.",
                "\u0646\u062d\u0646 \u0647\u0646\u0627 \u0644\u0644\u0625\u062c\u0627\u0628\u0629 \u0639\u0644\u0649 \u0623\u0643\u062b\u0631 \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u062a\u0643\u0631\u0627\u0631\u064b\u0627.",
              )}
            </span>
          </div>
          <Link to="/store/support" className="store-link-inline">
            {tr("Need another answer? Talk to us now", "\u0644\u0645 \u062a\u062c\u062f \u0625\u062c\u0627\u0628\u062a\u0643\u061f \u062a\u062d\u062f\u062b \u0645\u0639\u0646\u0627 \u0627\u0644\u0622\u0646")}
            <ArrowRight size={14} />
          </Link>
        </div>
        <div className="store-faq-grid">
          {localizedFaqItems.map((item, index) => (
            <Motion.article
              key={item.id}
              className={`store-faq-card${openFaqItems.has(item.id) ? " is-open" : ""}`}
              layout
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.28, delay: index * 0.05 }}
            >
              <div className="store-faq-card-head">
                <button
                  type="button"
                  className="store-faq-icon"
                  onClick={() => toggleFaq(item.id)}
                  aria-expanded={openFaqItems.has(item.id)}
                  aria-label={openFaqItems.has(item.id) ? tr("Hide answer", "\u0625\u062e\u0641\u0627\u0621 \u0627\u0644\u0625\u062c\u0627\u0628\u0629") : tr("Show answer", "\u0625\u0638\u0647\u0627\u0631 \u0627\u0644\u0625\u062c\u0627\u0628\u0629")}
                >
                  <X size={18} />
                </button>
                <div className="store-faq-title-wrap">
                  <span>{item.id}</span>
                  <h4>{item.questionLabel}</h4>
                </div>
              </div>
              {openFaqItems.has(item.id) ? <p>{item.answerLabel}</p> : null}
              {openFaqItems.has(item.id) ? (
                <Link to="/store/support" className="store-faq-link">
                  {tr("Need another answer? Talk to us now", "\u0644\u0645 \u062a\u062c\u062f \u0625\u062c\u0627\u0628\u062a\u0643\u061f \u062a\u062d\u062f\u062b \u0645\u0639\u0646\u0627 \u0627\u0644\u0622\u0646")}
                </Link>
              ) : null}
            </Motion.article>
          ))}
        </div>
      </section>
    </div>
  );
}
function StoreProductsPage() {
  const location = useLocation();
  const { products, meta, addToCart, tr, isArabic } = useStore();
  const localizedProducts = useMemo(() => products.map((product) => localizeStoreProduct(product, isArabic)), [products, isArabic]);
  const [filters, setFilters] = useState({
    query: "",
    category: "",
    brand: "",
    ram: "",
    storage: "",
    minPrice: "",
    maxPrice: "",
    sort: "featured",
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextBrand = params.get("brand") || "";
    const nextCategory = params.get("category") || "";
    const nextQuery = params.get("query") || "";
    const nextSort = params.get("sort") || "featured";

    setFilters((prev) => ({
      ...prev,
      brand: nextBrand,
      category: nextCategory,
      query: nextQuery,
      sort: nextSort,
    }));
  }, [location.search]);

  const categoryOptions = useMemo(() => {
    const options = new Map();

    localizedProducts.forEach((product) => {
      const rawValue = safeText(product.category) || safeText(product.categoryAr) || safeText(product.displayCategory);
      const label = safeText(product.displayCategory) || rawValue;
      if (rawValue && !options.has(rawValue)) {
        options.set(rawValue, label);
      }
    });

    for (const category of meta?.filters?.categories || []) {
      const rawValue = safeText(category);
      if (rawValue && !options.has(rawValue)) {
        options.set(rawValue, rawValue);
      }
    }

    return [...options.entries()].map(([value, label]) => ({ value, label }));
  }, [localizedProducts, meta?.filters?.categories]);

  const filteredProducts = useMemo(() => {
    const text = filters.query.trim().toLowerCase();
    return [...localizedProducts]
      .filter((product) => {
        const rawCategory = safeText(product.category) || safeText(product.categoryAr) || safeText(product.displayCategory);
        if (filters.category && rawCategory !== filters.category) {
          return false;
        }
        if (filters.brand && product.brand !== filters.brand) {
          return false;
        }
        if (filters.ram && product.ram !== filters.ram) {
          return false;
        }
        if (filters.storage && product.storage !== filters.storage) {
          return false;
        }
        const minPrice = Number(filters.minPrice || 0);
        const maxPrice = Number(filters.maxPrice || 0);
        if (minPrice > 0 && Number(product.discountedPrice || 0) < minPrice) {
          return false;
        }
        if (maxPrice > 0 && Number(product.discountedPrice || 0) > maxPrice) {
          return false;
        }
        if (text) {
          const blob = [
            product.laptopName,
            product.laptopNameAr,
            product.displayName,
            product.brand,
            product.category,
            product.categoryAr,
            product.displayCategory,
            product.ram,
            product.storage,
            product.description,
            product.descriptionAr,
            product.displayDescription,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!blob.includes(text)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (filters.sort === "price_asc") {
          return Number(a.discountedPrice || 0) - Number(b.discountedPrice || 0);
        }
        if (filters.sort === "price_desc") {
          return Number(b.discountedPrice || 0) - Number(a.discountedPrice || 0);
        }
        if (filters.sort === "newest") {
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        }
        return Number(b.bestOffer) - Number(a.bestOffer);
      });
  }, [filters, localizedProducts]);

  return (
    <div className="store-stack">
      <section className="store-section">
        <div className="store-section-head">
          <h2>{tr("Product Catalog", "\u0643\u062a\u0627\u0644\u0648\u062c \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a")}</h2>
          <p>{tr("Filter by brand, memory, storage, price range, and free-text search.", "\u0641\u0644\u062a\u0631\u0629 \u062d\u0633\u0628 \u0627\u0644\u0645\u0627\u0631\u0643\u0629 \u0648\u0627\u0644\u0631\u0627\u0645 \u0648\u0627\u0644\u062a\u062e\u0632\u064a\u0646 \u0648\u0627\u0644\u0633\u0639\u0631 \u0648\u0627\u0644\u0628\u062d\u062b \u0627\u0644\u0646\u0635\u064a.")}</p>
        </div>
        <div className="store-filter-grid">
          <input
            placeholder={tr("Search laptops", "\u0627\u0628\u062d\u062b \u0639\u0646 \u0644\u0627\u0628\u062a\u0648\u0628")}
            value={filters.query}
            onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
          />
          <select
            value={filters.brand}
            onChange={(event) => setFilters((prev) => ({ ...prev, brand: event.target.value }))}
          >
            <option value="">{tr("All Brands", "\u0643\u0644 \u0627\u0644\u0645\u0627\u0631\u0643\u0627\u062a")}</option>
            {(meta?.filters?.brands || []).map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
          <select
            value={filters.category}
            onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
          >
            <option value="">{tr("All Categories", "\u0643\u0644 \u0627\u0644\u0641\u0626\u0627\u062a")}</option>
            {categoryOptions.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
          <select
            value={filters.ram}
            onChange={(event) => setFilters((prev) => ({ ...prev, ram: event.target.value }))}
          >
            <option value="">{tr("All RAM", "\u0643\u0644 \u0627\u0644\u0631\u0627\u0645")}</option>
            {(meta?.filters?.rams || []).map((ram) => (
              <option key={ram} value={ram}>
                {ram}
              </option>
            ))}
          </select>
          <select
            value={filters.storage}
            onChange={(event) => setFilters((prev) => ({ ...prev, storage: event.target.value }))}
          >
            <option value="">{tr("All Storage", "\u0643\u0644 \u0627\u0644\u0633\u0639\u0627\u062a")}</option>
            {(meta?.filters?.storages || []).map((storage) => (
              <option key={storage} value={storage}>
                {storage}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            placeholder={tr("Min Price", "\u0627\u0642\u0644 \u0633\u0639\u0631")}
            value={filters.minPrice}
            onChange={(event) => setFilters((prev) => ({ ...prev, minPrice: event.target.value }))}
          />
          <input
            type="number"
            min="0"
            placeholder={tr("Max Price", "\u0627\u0639\u0644\u0649 \u0633\u0639\u0631")}
            value={filters.maxPrice}
            onChange={(event) => setFilters((prev) => ({ ...prev, maxPrice: event.target.value }))}
          />
          <select
            value={filters.sort}
            onChange={(event) => setFilters((prev) => ({ ...prev, sort: event.target.value }))}
          >
            <option value="featured">{tr("Featured", "\u0645\u0645\u064a\u0632")}</option>
            <option value="price_asc">{tr("Price: Low to High", "\u0627\u0644\u0633\u0639\u0631: \u0645\u0646 \u0627\u0644\u0627\u0642\u0644 \u0644\u0644\u0627\u0639\u0644\u0649")}</option>
            <option value="price_desc">{tr("Price: High to Low", "\u0627\u0644\u0633\u0639\u0631: \u0645\u0646 \u0627\u0644\u0627\u0639\u0644\u0649 \u0644\u0644\u0627\u0642\u0644")}</option>
            <option value="newest">{tr("Newest", "\u0627\u0644\u0627\u062d\u062f\u062b")}</option>
          </select>
        </div>

        <div className="store-product-grid">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} onAddToCart={addToCart} />
          ))}
        </div>
      </section>
    </div>
  );
}

function StoreProductDetailsPage() {
  const { productId } = useParams();
  const {
    products,
    meta,
    addToCart,
    addProductReview,
    isCustomerAuthenticated,
    customerUser,
    formatPrice,
    tr,
    isArabic,
  } = useStore();
  const [detail, setDetail] = useState(null);
  const [related, setRelated] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [imageIndex, setImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const zoomFrameRef = useRef(null);

  const localProduct = products.find((product) => product.id === productId);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoadingDetail(true);
      if (localProduct) {
        setDetail(localProduct);
        setRelated(
          products
            .filter((item) => item.id !== localProduct.id && item.brand === localProduct.brand)
            .slice(0, 4),
        );
        setLoadingDetail(false);
        return;
      }
      try {
        const response = await storeApi.get(`/products/${productId}`);
        if (!mounted) {
          return;
        }
        setDetail(normalizeClientStoreProduct(response.data?.product || null));
        setRelated((response.data?.relatedProducts || []).map(normalizeClientStoreProduct));
      } catch {
        if (!mounted) {
          return;
        }
        setDetail(null);
      } finally {
        if (mounted) {
          setLoadingDetail(false);
        }
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [localProduct, productId, products]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const media = window.matchMedia("(pointer: coarse)");
    const syncTouchState = () => {
      setIsTouchDevice(Boolean(media.matches || "ontouchstart" in window));
    };
    syncTouchState();
    media.addEventListener?.("change", syncTouchState);
    return () => media.removeEventListener?.("change", syncTouchState);
  }, []);

  function setZoomPoint(clientX, clientY) {
    const frame = zoomFrameRef.current;
    if (!frame) {
      return;
    }
    const bounds = frame.getBoundingClientRect();
    const x = ((clientX - bounds.left) / bounds.width) * 100;
    const y = ((clientY - bounds.top) / bounds.height) * 100;
    frame.style.setProperty("--zoom-x", `${Math.min(100, Math.max(0, x))}%`);
    frame.style.setProperty("--zoom-y", `${Math.min(100, Math.max(0, y))}%`);
  }

  function applyZoomPoint(event) {
    setZoomPoint(event.clientX, event.clientY);
  }

  function stopZoom() {
    setIsImageZoomed(false);
    const frame = zoomFrameRef.current;
    if (!frame) {
      return;
    }
    frame.style.setProperty("--zoom-x", "50%");
    frame.style.setProperty("--zoom-y", "50%");
  }

  useEffect(() => {
    setImageIndex(0);
    stopZoom();
  }, [detail?.id]);

  function handleTouchStart(event) {
    const touch = event.touches?.[0];
    if (!touch) {
      return;
    }
    setIsImageZoomed(true);
    setZoomPoint(touch.clientX, touch.clientY);
  }

  function handleTouchMove(event) {
    if (!isImageZoomed) {
      return;
    }
    const touch = event.touches?.[0];
    if (!touch) {
      return;
    }
    event.preventDefault();
    setZoomPoint(touch.clientX, touch.clientY);
  }

  function handleStageClick(event) {
    if (!isTouchDevice) {
      return;
    }
    if (isImageZoomed) {
      stopZoom();
      return;
    }
    setIsImageZoomed(true);
    setZoomPoint(event.clientX, event.clientY);
  }

  async function submitReview(event) {
    event.preventDefault();
    if (!isCustomerAuthenticated) {
      toast.error(
        tr(
          "Please login first to submit a review.",
          "\u064a\u0631\u062c\u0649 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0623\u0648\u0644\u064b\u0627 \u0644\u0625\u0636\u0627\u0641\u0629 \u062a\u0642\u064a\u064a\u0645.",
        ),
      );
      return;
    }
    if (submittingReview) {
      return;
    }
    setSubmittingReview(true);
    try {
      await addProductReview(detail.id, {
        rating: reviewRating,
        comment: reviewComment,
      });
      setReviewComment("");
      toast.success(tr("Your review has been saved.", "\u062a\u0645 \u062d\u0641\u0638 \u062a\u0642\u064a\u064a\u0645\u0643 \u0628\u0646\u062c\u0627\u062d."));
    } catch (error) {
      toast.error(
        error?.response?.data?.error
        || error.message
        || tr("Failed to submit review.", "\u062a\u0639\u0630\u0631 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062a\u0642\u064a\u064a\u0645."),
      );
    } finally {
      setSubmittingReview(false);
    }
  }

  if (loadingDetail) {
    return (
      <section className="store-section">
        <p>{tr("Loading product details...", "\u062c\u0627\u0631\u064a \u062a\u062d\u0645\u064a\u0644 \u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0645\u0646\u062a\u062c...")}</p>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="store-section">
        <p>{tr("Product not found.", "\u0627\u0644\u0645\u0646\u062a\u062c \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f.")}</p>
        <Link className="store-secondary-btn" to="/store/products">
          {tr("Back to Products", "\u0627\u0644\u0631\u062c\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a")}
        </Link>
      </section>
    );
  }

  const localizedDetail = localizeStoreProduct(detail, isArabic);
  const localizedRelated = related.map((product) => localizeStoreProduct(product, isArabic));
  const images = productImages(localizedDetail);
  const selected = images[Math.min(imageIndex, images.length - 1)];
  const reviews = Array.isArray(localizedDetail.reviews) ? localizedDetail.reviews : [];
  const maxQuantity = Math.max(1, Number(localizedDetail.stock || 1));
  const areReviewsEnabled = meta?.features?.reviewsEnabled !== false;
  const specGroups = [
    {
      title: tr("Core Specs", "\u0627\u0644\u0645\u0648\u0627\u0635\u0641\u0627\u062a \u0627\u0644\u0623\u0633\u0627\u0633\u064a\u0629"),
      items: [
        [tr("RAM", "\u0627\u0644\u0631\u0627\u0645"), localizedDetail.ram],
        [tr("Storage", "\u0627\u0644\u062a\u062e\u0632\u064a\u0646"), localizedDetail.storage],
        ["CPU", localizedDetail.displaySpecs?.cpu],
        ["GPU", localizedDetail.displaySpecs?.gpu],
      ],
    },
    {
      title: tr("Display and Build", "\u0627\u0644\u0634\u0627\u0634\u0629 \u0648\u0627\u0644\u062a\u0635\u0645\u064a\u0645"),
      items: [
        [tr("Display", "\u0627\u0644\u0634\u0627\u0634\u0629"), localizedDetail.displaySpecs?.display],
        ["OS", localizedDetail.displaySpecs?.os],
        [tr("Weight", "\u0627\u0644\u0648\u0632\u0646"), localizedDetail.displaySpecs?.weight],
        [tr("Battery", "\u0627\u0644\u0628\u0637\u0627\u0631\u064a\u0629"), localizedDetail.displaySpecs?.battery],
      ],
    },
  ]
    .map((group) => ({
      ...group,
      items: group.items.filter(([, value]) => String(value || "").trim()),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="store-stack">
      <section className="store-detail">
        <div className="store-detail-gallery">
          <div
            ref={zoomFrameRef}
            className={`store-detail-stage${isImageZoomed ? " is-zoomed" : ""}`}
            onMouseEnter={() => {
              if (!isTouchDevice) {
                setIsImageZoomed(true);
              }
            }}
            onMouseMove={(event) => {
              if (!isTouchDevice) {
                applyZoomPoint(event);
              }
            }}
            onMouseLeave={() => {
              if (!isTouchDevice) {
                stopZoom();
              }
            }}
            onClick={handleStageClick}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
          >
            <StoreAdaptiveImage src={selected} alt={localizedDetail.displayName} className="store-detail-main-image" profile="detail" />
            <div className="store-detail-zoom-hint">
              {isTouchDevice
                ? tr("Tap image to zoom", "\u0627\u0636\u063a\u0637 \u0639\u0644\u0649 \u0627\u0644\u0635\u0648\u0631\u0629 \u0644\u0644\u062a\u0643\u0628\u064a\u0631")
                : tr("Hover image to zoom", "\u062d\u0631\u0643 \u0627\u0644\u0645\u0627\u0648\u0633 \u0639\u0644\u0649 \u0627\u0644\u0635\u0648\u0631\u0629 \u0644\u0644\u062a\u0643\u0628\u064a\u0631")}
            </div>
          </div>
          <div className="store-thumb-row">
            {images.map((image, index) => (
              <button
                key={`${detail.id}_img_${index}`}
                type="button"
                className={index === imageIndex ? "active" : ""}
                onClick={() => setImageIndex(index)}
              >
                <StoreAdaptiveImage src={image} alt={`${localizedDetail.displayName} ${index + 1}`} profile="compact" />
              </button>
            ))}
          </div>
        </div>

        <div className="store-detail-info">
          <p className="store-eyebrow">{localizedDetail.brand}</p>
          <h1>{localizedDetail.displayName}</h1>
          <p>{localizedDetail.displayDescription}</p>
          <div className="store-product-price">
            {localizedDetail.discountPercent > 0 ? (
              <>
                <span className="new">{formatPrice(Number(localizedDetail.discountedPrice || 0))}</span>
                <span className="old">{formatPrice(Number(localizedDetail.price || 0))}</span>
              </>
            ) : (
              <span className="new">{formatPrice(Number(localizedDetail.price || 0))}</span>
            )}
          </div>

          <div className="store-badges">
            <span>
              <BadgeCheck size={14} />
              {localizedDetail.stock > 0
                ? tr(`Available (${localizedDetail.stock})`, `\u0645\u062a\u0627\u062d (${localizedDetail.stock})`)
                : tr("Out of stock", "\u063a\u064a\u0631 \u0645\u062a\u0648\u0641\u0631")}
            </span>
            <span>
              <Truck size={14} />
              {localizedDetail.displayShippingInfo}
            </span>
            <span>
              <BadgeCheck size={14} />
              {tr("Warranty", "\u0627\u0644\u0636\u0645\u0627\u0646")}: {localizedDetail.warrantyMonths} {tr("months", "\u0634\u0647\u0631")}
            </span>
            {areReviewsEnabled ? (
              <span>
                <Star size={14} />
                {tr("Rating", "\u0627\u0644\u062a\u0642\u064a\u064a\u0645")}: {Number(localizedDetail.averageRating || 0).toFixed(1)} ({number.format(localizedDetail.reviewCount || 0)} {tr("reviews", "\u062a\u0642\u064a\u064a\u0645")})
              </span>
            ) : null}
          </div>

          <div className="store-qty-row">
            <div className="store-qty-control">
              <button type="button" className="store-qty-btn" onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}>
                <Minus size={14} />
              </button>
              <input
                type="number"
                min="1"
                max={maxQuantity}
                value={quantity}
                onChange={(event) => setQuantity(Math.min(maxQuantity, Math.max(1, Number.parseInt(event.target.value, 10) || 1)))}
              />
              <button
                type="button"
                className="store-qty-btn"
                onClick={() => setQuantity((prev) => Math.min(maxQuantity, prev + 1))}
              >
                <Plus size={14} />
              </button>
            </div>
            <button type="button" className="store-primary-btn store-add-cart-btn" disabled={localizedDetail.stock <= 0} onClick={() => addToCart(localizedDetail.id, quantity)}>
              <ShoppingBag size={18} />
              {tr("Add To Cart", "\u0623\u0636\u0641 \u0644\u0644\u0633\u0644\u0629")}
            </button>
          </div>

          <div className="store-specs-grid">
            {specGroups.length > 0 ? (
              specGroups.map((group) => (
                <article key={group.title}>
                  <h4>{group.title}</h4>
                  {group.items.map(([label, value]) => (
                    <p key={label}>
                      <strong>{label}:</strong> {value}
                    </p>
                  ))}
                </article>
              ))
            ) : (
              <article>
                <h4>{tr("Specifications", "\u0627\u0644\u0645\u0648\u0627\u0635\u0641\u0627\u062a")}</h4>
                <p>{tr("Specifications will be added soon.", "\u0633\u064a\u062a\u0645 \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0645\u0648\u0627\u0635\u0641\u0627\u062a \u0642\u0631\u064a\u0628\u064b\u0627.")}</p>
              </article>
            )}
          </div>

          {areReviewsEnabled ? (
            <section className="store-reviews">
              <h3>{tr("Customer Reviews", "\u062a\u0642\u064a\u064a\u0645\u0627\u062a \u0627\u0644\u0639\u0645\u0644\u0627\u0621")}</h3>
              <form className="store-review-form" onSubmit={submitReview}>
                <select value={reviewRating} onChange={(event) => setReviewRating(Number.parseInt(event.target.value, 10) || 5)}>
                  <option value={5}>5 Stars</option>
                  <option value={4}>4 Stars</option>
                  <option value={3}>3 Stars</option>
                  <option value={2}>2 Stars</option>
                  <option value={1}>1 Star</option>
                </select>
                <input
                  value={reviewComment}
                  onChange={(event) => setReviewComment(event.target.value)}
                  placeholder={
                    isCustomerAuthenticated
                      ? tr("Write your review", "\u0627\u0643\u062a\u0628 \u062a\u0642\u064a\u064a\u0645\u0643")
                      : tr("Login to add review", "\u0633\u062c\u0644 \u062f\u062e\u0648\u0644 \u0644\u0625\u0636\u0627\u0641\u0629 \u062a\u0642\u064a\u064a\u0645")
                  }
                  disabled={!isCustomerAuthenticated}
                  required
                />
                <button type="submit" className="store-primary-btn" disabled={!isCustomerAuthenticated || submittingReview}>
                  {submittingReview
                    ? tr("Submitting...", "\u062c\u0627\u0631\u064d \u0627\u0644\u0625\u0631\u0633\u0627\u0644...")
                    : tr("Submit Review", "\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062a\u0642\u064a\u064a\u0645")}
                </button>
              </form>
              {isCustomerAuthenticated ? (
                <p className="review-hint">{tr("Signed in as", "\u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0628\u0627\u0633\u0645")} {customerUser?.name}</p>
              ) : (
                <p className="review-hint">
                  {tr("Please", "\u0645\u0646 \u0641\u0636\u0644\u0643")}{" "}
                  <Link to="/store/account">{tr("login", "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644")}</Link>{" "}
                  {tr("to rate this product.", "\u0644\u062a\u0642\u064a\u064a\u0645 \u0647\u0630\u0627 \u0627\u0644\u0645\u0646\u062a\u062c.")}
                </p>
              )}
              <div className="store-review-list">
                {reviews.length === 0 ? (
                  <p>{tr("No reviews yet.", "\u0644\u0627 \u062a\u0648\u062c\u062f \u062a\u0642\u064a\u064a\u0645\u0627\u062a \u062d\u062a\u0649 \u0627\u0644\u0622\u0646.")}</p>
                ) : (
                  reviews.slice(0, 8).map((review) => (
                    <article key={review.id}>
                      <div>
                        <strong>{review.customerName}</strong>
                        <span>{Number(review.rating || 0)} / 5</span>
                      </div>
                      <p>{review.comment}</p>
                    </article>
                  ))
                )}
              </div>
            </section>
          ) : null}
        </div>
      </section>

      <section className="store-section">
        <div className="store-section-head">
          <h2>{tr("Related Products", "\u0645\u0646\u062a\u062c\u0627\u062a \u0645\u0634\u0627\u0628\u0647\u0629")}</h2>
        </div>
        <div className="store-product-grid">
          {localizedRelated.map((product) => (
            <ProductCard key={product.id} product={product} onAddToCart={addToCart} />
          ))}
        </div>
      </section>
    </div>
  );
}
function StoreCartPage() {
  const {
    cartItems,
    updateQuantity,
    removeFromCart,
    subtotal,
    shippingCost,
    total,
    formatPrice,
    tr,
    isArabic,
    isCustomerAuthenticated,
  } = useStore();

  if (cartItems.length === 0) {
    return (
      <section className="store-section empty-state">
        <h2>{tr("Your cart is empty.", "\u0627\u0644\u0633\u0644\u0629 \u0641\u0627\u0631\u063a\u0629.")}</h2>
        <p>{tr("Start by browsing laptops and add your favorite models.", "\u0627\u0628\u062f\u0623 \u0628\u062a\u0635\u0641\u062d \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a \u0648\u0627\u062e\u062a\u0631 \u0645\u0627 \u064a\u0646\u0627\u0633\u0628\u0643.")}</p>
        <Link to="/store/products" className="store-primary-btn">
          {tr("Browse Products", "\u062a\u0635\u0641\u062d \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a")}
        </Link>
      </section>
    );
  }

  return (
    <div className="store-cart-layout">
      <section className="store-section">
        <div className="store-section-head">
          <h2>{tr("Cart Items", "\u0645\u062d\u062a\u0648\u064a\u0627\u062a \u0627\u0644\u0633\u0644\u0629")}</h2>
        </div>
        <div className="store-cart-list">
          <AnimatePresence initial={false}>
            {cartItems.map((item) => {
              const localizedItem = localizeStoreProduct(item, isArabic);
              return (
              <Motion.article
                key={localizedItem.id}
                className="store-cart-item"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <StoreAdaptiveImage src={productImages(localizedItem)[0]} alt={localizedItem.displayName} profile="compact" />
                <div className="store-cart-meta">
                  <h3>{localizedItem.displayName}</h3>
                  <p>{localizedItem.brand}</p>
                  <p>
                    {localizedItem.ram} RAM | {localizedItem.storage}
                  </p>
                  <p className="price">{formatPrice(Number(localizedItem.discountedPrice || 0))}</p>
                </div>
                <div className="store-cart-actions">
                  <div className="store-qty-mini">
                    <button type="button" onClick={() => updateQuantity(localizedItem.id, localizedItem.quantity - 1)}>
                      <Minus size={12} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={localizedItem.quantity}
                      onChange={(event) => updateQuantity(localizedItem.id, event.target.value)}
                    />
                    <button type="button" onClick={() => updateQuantity(localizedItem.id, localizedItem.quantity + 1)}>
                      <Plus size={12} />
                    </button>
                  </div>
                  <button type="button" className="store-danger-btn" onClick={() => removeFromCart(localizedItem.id)}>
                    <Trash2 size={14} />
                    {tr("Remove", "\u062d\u0630\u0641")}
                  </button>
                </div>
              </Motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      </section>

      <aside className="store-section store-summary">
        <h3>{tr("Order Summary", "\u0645\u0644\u062e\u0635 \u0627\u0644\u0637\u0644\u0628")}</h3>
        <p>
          <span>{tr("Subtotal", "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0641\u0631\u0639\u064a")}</span>
          <strong>{formatPrice(subtotal)}</strong>
        </p>
        <p>
          <span>{tr("Shipping", "\u0627\u0644\u0634\u062d\u0646")}</span>
          <strong>{formatPrice(shippingCost)}</strong>
        </p>
        <p className="total">
          <span>{tr("Total", "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a")}</span>
          <strong>{formatPrice(total)}</strong>
        </p>
        {isCustomerAuthenticated ? (
          <Link to="/store/checkout" className="store-primary-btn">
            {tr("Proceed To Checkout", "\u0627\u0643\u0645\u0644 \u0625\u0644\u0649 \u0627\u0644\u062f\u0641\u0639")}
            <ArrowRight size={14} />
          </Link>
        ) : (
          <>
            <p className="store-login-note">
              {tr(
                "You need a customer account before checkout.",
                "\u064a\u062c\u0628 \u062a\u0633\u062c\u064a\u0644 \u062d\u0633\u0627\u0628 \u0639\u0645\u064a\u0644 \u0642\u0628\u0644 \u0625\u0643\u0645\u0627\u0644 \u0627\u0644\u0637\u0644\u0628.",
              )}
            </p>
            <Link to="/store/account" state={{ from: "/store/checkout" }} className="store-primary-btn">
              {tr("Login To Continue", "\u0633\u062c\u0644 \u062f\u062e\u0648\u0644\u0643 \u0644\u0644\u0645\u062a\u0627\u0628\u0639\u0629")}
              <ArrowRight size={14} />
            </Link>
          </>
        )}
      </aside>
    </div>
  );
}

function StoreCheckoutPage() {
  const navigate = useNavigate();
  const {
    cartItems,
    subtotal,
    shippingCost,
    total,
    saveCheckoutDraft,
    checkoutDraft,
    customerUser,
    formatPrice,
    tr,
    currency,
    setCurrency,
    isArabic,
  } = useStore();
  const [form, setForm] = useState({
    country: "",
    address: "",
    city: "",
    notes: "",
  });

  useEffect(() => {
    setForm((prev) => ({
      country:
        checkoutDraft?.customer?.country
        || customerUser?.country
        || prev.country
        || countryFromCurrency(currency),
      address: checkoutDraft?.customer?.address || customerUser?.address || prev.address,
      city: checkoutDraft?.customer?.city || customerUser?.city || prev.city,
      notes: checkoutDraft?.customer?.notes || prev.notes,
    }));
  }, [checkoutDraft?.customer, currency, customerUser]);

  if (cartItems.length === 0) {
    return <Navigate to="/store/cart" replace />;
  }

  if (!customerUser?.name || !customerUser?.email || !customerUser?.phone) {
    return <Navigate to="/store/account" replace state={{ from: "/store/checkout" }} />;
  }

  async function submitCheckout(event) {
    event.preventDefault();
    saveCheckoutDraft({
      customer: {
        name: customerUser?.name || "",
        email: customerUser?.email || "",
        phone: customerUser?.phone || "",
        country: form.country,
        address: form.address,
        city: form.city,
        notes: form.notes,
      },
    });
    navigate("/store/payment");
  }

  return (
    <div className="store-cart-layout">
      <section className="store-section">
        <div className="store-section-head">
          <h2>{tr("Checkout", "\u0625\u062a\u0645\u0627\u0645 \u0627\u0644\u0637\u0644\u0628")}</h2>
          <p>
            {tr(
              "Use your account details. Edit the shipping address here only when needed.",
              "\u0627\u0633\u062a\u062e\u062f\u0645 \u0628\u064a\u0627\u0646\u0627\u062a \u062d\u0633\u0627\u0628\u0643\u060c \u0648\u0639\u062f\u0644 \u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0634\u062d\u0646 \u0647\u0646\u0627 \u0641\u0642\u0637 \u0639\u0646\u062f \u0627\u0644\u062d\u0627\u062c\u0629.",
            )}
          </p>
          <p>{tr("Displayed currency", "\u0627\u0644\u0639\u0645\u0644\u0629 \u0627\u0644\u0645\u0639\u0631\u0648\u0636\u0629")}: {currency}</p>
        </div>

        <form className="store-checkout-form" onSubmit={submitCheckout}>
          <div className="store-customer-inline span-2">
            <article>
              <strong>{customerUser?.name || tr("Customer", "\u0627\u0644\u0639\u0645\u064a\u0644")}</strong>
              <span>{customerUser?.email || "-"}</span>
            </article>
            <article>
              <strong>{tr("Phone", "\u0627\u0644\u0647\u0627\u062a\u0641")}</strong>
              <span>
                {customerUser?.phone || tr("Update it from account page", "\u062d\u062f\u0651\u062b\u0647 \u0645\u0646 \u0635\u0641\u062d\u0629 \u0627\u0644\u062d\u0633\u0627\u0628")}
              </span>
            </article>
          </div>
          <label className="span-2">
            {tr("Country", "\u0627\u0644\u062f\u0648\u0644\u0629")}
            <select
              value={form.country}
              onChange={(event) => {
                const nextCountry = event.target.value;
                setForm((prev) => ({ ...prev, country: nextCountry }));
                const nextCurrency = currencyForCountry(nextCountry);
                if (nextCurrency) {
                  setCurrency(nextCurrency);
                }
              }}
              required
            >
              <option value="">{tr("Select country", "\u0627\u062e\u062a\u0631 \u0627\u0644\u062f\u0648\u0644\u0629")}</option>
              {COUNTRY_OPTIONS.map((country) => (
                <option key={country.code} value={country.code}>
                  {tr(country.nameEn, country.nameAr)} - {country.currency}
                </option>
              ))}
            </select>
          </label>
          <label className="span-2">
            {tr("Address", "\u0627\u0644\u0639\u0646\u0648\u0627\u0646")}
            <input
              value={form.address}
              onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
              required
            />
          </label>
          <label>
            {tr("City", "\u0627\u0644\u0645\u062f\u064a\u0646\u0629")}
            <input
              value={form.city}
              onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
              required
            />
          </label>
          <label>
            {tr("Payment", "\u0627\u0644\u062f\u0641\u0639")}
            <input value={tr("Cash on Delivery", "\u062f\u0641\u0639 \u0639\u0646\u062f \u0627\u0644\u0627\u0633\u062a\u0644\u0627\u0645")} disabled />
          </label>
          <label className="span-2">
            {tr("Notes (Optional)", "\u0645\u0644\u0627\u062d\u0638\u0627\u062a (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)")}
            <textarea
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </label>

          <button type="submit" className="store-primary-btn span-2">
            {tr("Continue To Payment", "\u0645\u062a\u0627\u0628\u0639\u0629 \u0625\u0644\u0649 \u0627\u0644\u062f\u0641\u0639")}
          </button>
        </form>
      </section>

      <aside className="store-section store-summary">
        <h3>{tr("Order Summary", "\u0645\u0644\u062e\u0635 \u0627\u0644\u0637\u0644\u0628")}</h3>
        {cartItems.map((item) => {
          const localizedItem = localizeStoreProduct(item, isArabic);
          return (
          <p key={localizedItem.id}>
            <span>
              {localizedItem.displayName} x {localizedItem.quantity}
            </span>
            <strong>{formatPrice(localizedItem.lineTotal)}</strong>
          </p>
          );
        })}
        <p>
          <span>{tr("Subtotal", "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0641\u0631\u0639\u064a")}</span>
          <strong>{formatPrice(subtotal)}</strong>
        </p>
        <p>
          <span>{tr("Shipping", "\u0627\u0644\u0634\u062d\u0646")}</span>
          <strong>{formatPrice(shippingCost)}</strong>
        </p>
        <p className="total">
          <span>{tr("Total", "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a")}</span>
          <strong>{formatPrice(total)}</strong>
        </p>
      </aside>
    </div>
  );
}

function StorePaymentPage() {
  const navigate = useNavigate();
  const {
    cartItems,
    subtotal,
    shippingCost,
    total,
    checkoutDraft,
    saveCheckoutDraft,
    placeOrder,
    customerUser,
    formatPrice,
    tr,
    currency,
    isArabic,
  } = useStore();
  const [saving, setSaving] = useState(false);

  if (cartItems.length === 0) {
    return <Navigate to="/store/cart" replace />;
  }

  if (!customerUser?.name || !customerUser?.email || !customerUser?.phone) {
    return <Navigate to="/store/account" replace state={{ from: "/store/checkout" }} />;
  }

  if (!checkoutDraft?.customer?.name || !checkoutDraft?.customer?.email || !checkoutDraft?.customer?.phone) {
    return <Navigate to="/store/checkout" replace />;
  }

  async function confirmPayment(event) {
    event.preventDefault();
    if (saving) {
      return;
    }
    setSaving(true);
    try {
      const order = await placeOrder({
        customer: checkoutDraft.customer,
        paymentMethod: checkoutDraft.paymentMethod || "cash_on_delivery",
        paymentReference: checkoutDraft.paymentReference || "",
      });
      navigate(`/store/success/${order.orderNumber}`, {
        state: {
          order,
          customerName: checkoutDraft.customer.name,
        },
      });
      toast.success(tr(`Order ${order.orderNumber} placed successfully.`, `\u062a\u0645 \u062a\u0623\u0643\u064a\u062f \u0627\u0644\u0637\u0644\u0628 ${order.orderNumber} \u0628\u0646\u062c\u0627\u062d.`));
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Payment step failed. Try again.", "\u0641\u0634\u0644\u062a \u062e\u0637\u0648\u0629 \u0627\u0644\u062f\u0641\u0639. \u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="store-cart-layout">
      <section className="store-section">
        <div className="store-section-head">
          <h2>{tr("Payment", "\u0627\u0644\u062f\u0641\u0639")}</h2>
          <p>{tr("Select payment method and confirm your order.", "\u0627\u062e\u062a\u0631 \u0637\u0631\u064a\u0642\u0629 \u0627\u0644\u062f\u0641\u0639 \u0648\u0623\u0643\u062f \u0637\u0644\u0628\u0643.")}</p>
          <p>{tr("Displayed currency", "\u0627\u0644\u0639\u0645\u0644\u0629 \u0627\u0644\u0645\u0639\u0631\u0648\u0636\u0629")}: {currency}</p>
        </div>

        <form className="store-checkout-form" onSubmit={confirmPayment}>
          <label className="span-2">
            {tr("Payment Method", "\u0637\u0631\u064a\u0642\u0629 \u0627\u0644\u062f\u0641\u0639")}
            <select
              value={checkoutDraft.paymentMethod || "cash_on_delivery"}
              onChange={(event) =>
                saveCheckoutDraft({ paymentMethod: event.target.value })
              }
            >
              <option value="cash_on_delivery">{tr("Cash On Delivery", "\u062f\u0641\u0639 \u0639\u0646\u062f \u0627\u0644\u0627\u0633\u062a\u0644\u0627\u0645")}</option>
              <option value="stripe">{tr("Stripe (Phase 2)", "Stripe (\u0627\u0644\u0645\u0631\u062d\u0644\u0629 2)")}</option>
              <option value="paymob">{tr("Paymob (Egypt)", "Paymob (\u0645\u0635\u0631)")}</option>
              <option value="vodafone_cash">{tr("Vodafone Cash", "\u0641\u0648\u062f\u0627\u0641\u0648\u0646 \u0643\u0627\u0634")}</option>
            </select>
          </label>
          <label className="span-2">
            {tr("Payment Reference (Optional)", "\u0645\u0631\u062c\u0639 \u0627\u0644\u062f\u0641\u0639 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)")}
            <input
              value={checkoutDraft.paymentReference || ""}
              onChange={(event) =>
                saveCheckoutDraft({ paymentReference: event.target.value })
              }
              placeholder={tr("Transaction ID / Last 4 digits", "\u0631\u0642\u0645 \u0627\u0644\u0639\u0645\u0644\u064a\u0629 / \u0622\u062e\u0631 4 \u0623\u0631\u0642\u0627\u0645")}
            />
          </label>
          <button type="submit" className="store-primary-btn span-2" disabled={saving}>
            {saving
              ? tr("Confirming...", "\u062c\u0627\u0631\u064a \u0627\u0644\u062a\u0623\u0643\u064a\u062f...")
              : tr("Confirm Payment & Place Order", "\u062a\u0623\u0643\u064a\u062f \u0627\u0644\u062f\u0641\u0639 \u0648\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0637\u0644\u0628")}
          </button>
        </form>
      </section>

      <aside className="store-section store-summary">
        <h3>{tr("Final Summary", "\u0627\u0644\u0645\u0644\u062e\u0635 \u0627\u0644\u0646\u0647\u0627\u0626\u064a")}</h3>
        {cartItems.map((item) => {
          const localizedItem = localizeStoreProduct(item, isArabic);
          return (
          <p key={localizedItem.id}>
            <span>
              {localizedItem.displayName} x {localizedItem.quantity}
            </span>
            <strong>{formatPrice(localizedItem.lineTotal)}</strong>
          </p>
          );
        })}
        <p>
          <span>{tr("Subtotal", "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0641\u0631\u0639\u064a")}</span>
          <strong>{formatPrice(subtotal)}</strong>
        </p>
        <p>
          <span>{tr("Shipping", "\u0627\u0644\u0634\u062d\u0646")}</span>
          <strong>{formatPrice(shippingCost)}</strong>
        </p>
        <p className="total">
          <span>{tr("Total", "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a")}</span>
          <strong>{formatPrice(total)}</strong>
        </p>
      </aside>
    </div>
  );
}

function StoreAccountPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    customerUser,
    isCustomerAuthenticated,
    registerCustomer,
    loginCustomer,
    updateCustomerProfile,
    uploadCustomerAvatar,
    changeCustomerPassword,
    logoutCustomer,
    customerOrders,
    customerOrderStats,
    tr,
    formatPrice,
    setCurrency,
    isArabic,
  } = useStore();
  const activeOrders = customerOrders.filter((order) =>
    ["pending", "confirmed", "shipped"].includes(String(order.status || "")),
  );
  const deliveredOrders = customerOrders.filter((order) => String(order.status || "") === "delivered");
  const cancelledOrders = customerOrders.filter((order) => String(order.status || "") === "cancelled");

  const [mode, setMode] = useState("login");
  const [authSaving, setAuthSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [authAvatarUploading, setAuthAvatarUploading] = useState(false);
  const [profileAvatarUploading, setProfileAvatarUploading] = useState(false);

  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    phone: "",
    country: countryFromCurrency(readStoreCurrency()),
    address: "",
    city: "",
    gender: "",
    birthDate: "",
    avatarUrl: "",
    password: "",
  });

  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
    country: "",
    address: "",
    city: "",
    gender: "",
    birthDate: "",
    avatarUrl: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const redirectPath = location.state?.from || "/store/account";

  useEffect(() => {
    if (!isCustomerAuthenticated || !customerUser) {
      return;
    }
    setProfileForm({
      name: customerUser.name || "",
      email: customerUser.email || "",
      phone: customerUser.phone || "",
      country: customerUser.country || "",
      address: customerUser.address || "",
      city: customerUser.city || "",
      gender: customerUser.gender || "",
      birthDate: customerUser.birthDate || "",
      avatarUrl: customerUser.avatarUrl || "",
    });
  }, [customerUser, isCustomerAuthenticated]);

  async function submit(event) {
    event.preventDefault();
    if (authSaving) {
      return;
    }
    setAuthSaving(true);
    try {
      if (mode === "register") {
        await registerCustomer(authForm);
        toast.success("Account created successfully.");
      } else {
        await loginCustomer({
          identifier: authForm.email,
          password: authForm.password,
        });
        toast.success("Logged in successfully.");
      }
      navigate(redirectPath, { replace: true });
    } catch (error) {
      toast.error(error?.response?.data?.error || "Account request failed.");
    } finally {
      setAuthSaving(false);
    }
  }

  async function handleAvatarUpload(file, target) {
    const setUploading = target === "auth" ? setAuthAvatarUploading : setProfileAvatarUploading;
    const setForm = target === "auth" ? setAuthForm : setProfileForm;
    setUploading(true);
    try {
      const avatarUrl = await uploadCustomerAvatar(file);
      setForm((prev) => ({ ...prev, avatarUrl }));
      toast.success(tr("Avatar uploaded.", "\u062a\u0645 \u0631\u0641\u0639 \u0627\u0644\u0635\u0648\u0631\u0629."));
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Could not upload image.", "\u062a\u0639\u0630\u0631 \u0631\u0641\u0639 \u0627\u0644\u0635\u0648\u0631\u0629."));
    } finally {
      setUploading(false);
    }
  }

  async function uploadAuthAvatar(event) {
    const file = event.target.files?.[0];
    if (!file || authAvatarUploading) {
      return;
    }
    await handleAvatarUpload(file, "auth");
    event.target.value = "";
  }

  async function uploadProfileAvatar(event) {
    const file = event.target.files?.[0];
    if (!file || profileAvatarUploading) {
      return;
    }
    await handleAvatarUpload(file, "profile");
    event.target.value = "";
  }

  async function submitProfile(event) {
    event.preventDefault();
    if (profileSaving) {
      return;
    }
    setProfileSaving(true);
    try {
      await updateCustomerProfile(profileForm);
      toast.success("Profile updated.");
    } catch (error) {
      toast.error(error?.response?.data?.error || "Could not update profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function submitPassword(event) {
    event.preventDefault();
    if (passwordSaving) {
      return;
    }
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New password and confirm password do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      await changeCustomerPassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Password updated.");
    } catch (error) {
      toast.error(error?.response?.data?.error || "Could not change password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  const callbackUrl = new URL(`${window.location.origin}/store/auth/callback`);
  if (redirectPath && redirectPath !== "/store/account") {
    callbackUrl.searchParams.set("next", redirectPath);
  }
  const googleLink = `/api/customer-auth/google/start?redirectTo=${encodeURIComponent(callbackUrl.toString())}`;
  const facebookLink = `/api/customer-auth/facebook/start?redirectTo=${encodeURIComponent(callbackUrl.toString())}`;

  return (
    <section className="store-section account-section">
      <div className="store-section-head">
        <h2>{tr("Customer Account", "\u062d\u0633\u0627\u0628 \u0627\u0644\u0639\u0645\u064a\u0644")}</h2>
      </div>

      {isCustomerAuthenticated ? (
        <div className="account-stack">
          <form className="store-checkout-form account-form" onSubmit={submitProfile}>
            <label>
              {tr("Full Name", "\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0643\u0627\u0645\u0644")}
              <input
                value={profileForm.name}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </label>
            <label>
              {tr("Email", "\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a")}
              <input
                type="email"
                value={profileForm.email}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, email: event.target.value }))}
                required
              />
            </label>
            <label>
              {tr("Phone", "\u0627\u0644\u0647\u0627\u062a\u0641")}
              <input
                value={profileForm.phone}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </label>
            <label>
              {tr("Country", "\u0627\u0644\u062f\u0648\u0644\u0629")}
              <select
                value={profileForm.country}
                onChange={(event) => {
                  const nextCountry = event.target.value;
                  setProfileForm((prev) => ({ ...prev, country: nextCountry }));
                  setCurrency(currencyForCountry(nextCountry));
                }}
                required
              >
                <option value="">{tr("Select country", "\u0627\u062e\u062a\u0631 \u0627\u0644\u062f\u0648\u0644\u0629")}</option>
              {COUNTRY_OPTIONS.map((country) => (
                <option key={country.code} value={country.code}>
                  {tr(country.nameEn, country.nameAr)} - {country.currency}
                </option>
              ))}
              </select>
            </label>
            <label>
              {tr("City", "\u0627\u0644\u0645\u062f\u064a\u0646\u0629")}
              <input
                value={profileForm.city}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, city: event.target.value }))}
              />
            </label>
            <label className="span-2">
              {tr("Address", "\u0627\u0644\u0639\u0646\u0648\u0627\u0646")}
              <input
                value={profileForm.address}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, address: event.target.value }))}
              />
            </label>
            <label>
              {tr("Gender", "\u0627\u0644\u0646\u0648\u0639")}
              <select
                value={profileForm.gender}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, gender: event.target.value }))}
              >
                <option value="">{tr("Prefer not to say", "\u0623\u0641\u0636\u0644 \u0639\u062f\u0645 \u0627\u0644\u0625\u062c\u0627\u0628\u0629")}</option>
                <option value="male">{tr("Male", "\u0630\u0643\u0631")}</option>
                <option value="female">{tr("Female", "\u0623\u0646\u062b\u0649")}</option>
                <option value="other">{tr("Other", "\u0623\u062e\u0631\u0649")}</option>
              </select>
            </label>
            <label>
              {tr("Birth Date", "\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0645\u064a\u0644\u0627\u062f")}
              <input
                type="date"
                value={profileForm.birthDate || ""}
                onChange={(event) => setProfileForm((prev) => ({ ...prev, birthDate: event.target.value }))}
              />
            </label>
            <StoreAvatarUploadField
              title={tr("Profile Image", "\u0635\u0648\u0631\u0629 \u0627\u0644\u062d\u0633\u0627\u0628")}
              helper={tr("Upload a profile photo from your device.", "\u0627\u0631\u0641\u0639 \u0635\u0648\u0631\u0629 \u0627\u0644\u062d\u0633\u0627\u0628 \u0645\u0646 \u062c\u0647\u0627\u0632\u0643.")}
              name={profileForm.name || customerUser?.name}
              avatarUrl={profileForm.avatarUrl}
              isUploading={profileAvatarUploading}
              onUpload={uploadProfileAvatar}
              onRemove={() => setProfileForm((prev) => ({ ...prev, avatarUrl: "" }))}
              tr={tr}
            />
            <button type="submit" className="store-primary-btn span-2" disabled={profileSaving}>
              {profileSaving ? tr("Saving...", "\u062c\u0627\u0631\u064d \u0627\u0644\u062d\u0641\u0638...") : tr("Save Profile", "\u062d\u0641\u0638 \u0627\u0644\u062d\u0633\u0627\u0628")}
            </button>
          </form>

          <div className="account-card">
            <StoreAvatar
              name={profileForm.name || customerUser?.name}
              avatarUrl={profileForm.avatarUrl}
              className="store-avatar account-avatar account-avatar-badge"
            />
            <p>
              {tr("Signed in as", "\u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0628\u0627\u0633\u0645")} <strong>{customerUser?.name}</strong>
            </p>
            <p>{customerUser?.email}</p>
            <p>{tr("Member since", "\u0639\u0636\u0648 \u0645\u0646\u0630")}: {formatDateTime(customerUser?.createdAt)}</p>
          </div>

          <section className="account-orders">
            <div className="store-section-head">
              <h3>{tr("My Orders", "\u0637\u0644\u0628\u0627\u062a\u064a")}</h3>
              <p>
                {tr("Active", "\u0627\u0644\u0646\u0634\u0637\u0629")}: {customerOrderStats?.active || 0} |{" "}
                {tr("Delivered", "\u0627\u0644\u0645\u0643\u062a\u0645\u0644\u0629")}: {customerOrderStats?.delivered || 0} |{" "}
                {tr("Cancelled", "\u0627\u0644\u0645\u0644\u063a\u0627\u0629")}: {customerOrderStats?.cancelled || 0}
              </p>
            </div>

            <div className="account-order-group">
              <h4>{tr("Current Orders", "\u0627\u0644\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u062d\u0627\u0644\u064a\u0629")}</h4>
              <div className="account-order-list">
                {activeOrders.length === 0 ? (
                  <p className="empty-note">{tr("No active orders.", "\u0644\u0627 \u062a\u0648\u062c\u062f \u0637\u0644\u0628\u0627\u062a \u0646\u0634\u0637\u0629.")}</p>
                ) : (
                  activeOrders.map((order) => (
                    <article key={order.id} className="account-order-card">
                      <div className="account-order-head">
                        <strong>{order.orderNumber}</strong>
                        <span className={`status-pill status-${String(order.status || "").replace(/\s+/g, "_")}`}>
                          {order.status}
                        </span>
                      </div>
                      <p>{formatDateTime(order.createdAt)}</p>
                      <p>{tr("Total", "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a")}: {formatPrice(Number(order.total || 0))}</p>
                      <ul>
                        {(order.items || []).map((item) => {
                          const localizedItem = localizeStoreProduct(item, isArabic);
                          return (
                          <li key={`${order.id}-${item.productId || item.laptopName}`}>
                            {localizedItem.displayName} x {item.quantity}
                          </li>
                          );
                        })}
                      </ul>
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="account-order-group">
              <h4>{tr("Delivered Orders", "\u0627\u0644\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u0645\u0643\u062a\u0645\u0644\u0629")}</h4>
              <div className="account-order-list">
                {deliveredOrders.length === 0 ? (
                  <p className="empty-note">
                    {tr("No delivered orders yet.", "\u0644\u0627 \u062a\u0648\u062c\u062f \u0637\u0644\u0628\u0627\u062a \u0645\u0643\u062a\u0645\u0644\u0629 \u0628\u0639\u062f.")}
                  </p>
                ) : (
                  deliveredOrders.map((order) => (
                    <article key={order.id} className="account-order-card">
                      <div className="account-order-head">
                        <strong>{order.orderNumber}</strong>
                        <span className="status-pill status-delivered">{order.status}</span>
                      </div>
                      <p>{formatDateTime(order.createdAt)}</p>
                      <p>{tr("Total", "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a")}: {formatPrice(Number(order.total || 0))}</p>
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="account-order-group">
              <h4>{tr("Cancelled Orders", "\u0627\u0644\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u0645\u0644\u063a\u0627\u0629")}</h4>
              <div className="account-order-list">
                {cancelledOrders.length === 0 ? (
                  <p className="empty-note">{tr("No cancelled orders.", "\u0644\u0627 \u062a\u0648\u062c\u062f \u0637\u0644\u0628\u0627\u062a \u0645\u0644\u063a\u0627\u0629.")}</p>
                ) : (
                  cancelledOrders.map((order) => (
                    <article key={order.id} className="account-order-card">
                      <div className="account-order-head">
                        <strong>{order.orderNumber}</strong>
                        <span className="status-pill status-cancelled">{order.status}</span>
                      </div>
                      <p>{formatDateTime(order.createdAt)}</p>
                      <p>{tr("Total", "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a")}: {formatPrice(Number(order.total || 0))}</p>
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>

          <form className="store-checkout-form account-form" onSubmit={submitPassword}>
            <label>
              {tr("Current Password", "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062d\u0627\u0644\u064a\u0629")}
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                }
                required
              />
            </label>
            <label>
              {tr("New Password", "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062c\u062f\u064a\u062f\u0629")}
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
                }
                required
              />
            </label>
            <label className="span-2">
              {tr("Confirm New Password", "\u062a\u0623\u0643\u064a\u062f \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062c\u062f\u064a\u062f\u0629")}
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                }
                required
              />
            </label>
            <button type="submit" className="store-secondary-btn span-2" disabled={passwordSaving}>
              {passwordSaving ? tr("Updating...", "\u062c\u0627\u0631\u064d \u0627\u0644\u062a\u062d\u062f\u064a\u062b...") : tr("Change Password", "\u062a\u063a\u064a\u064a\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631")}
            </button>
            <button type="button" className="store-danger-btn span-2" onClick={logoutCustomer}>
              {tr("Logout", "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c")}
            </button>
          </form>
        </div>
      ) : (
        <form className="store-checkout-form" onSubmit={submit}>
          {mode === "register" ? (
            <label>
              {tr("Name", "\u0627\u0644\u0627\u0633\u0645")}
              <input
                value={authForm.name}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </label>
          ) : null}
          <label>
            {mode === "register" ? tr("Email", "\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a") : tr("Email or Username", "\u0627\u0644\u0628\u0631\u064a\u062f \u0623\u0648 \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645")}
            <input
              type={mode === "register" ? "email" : "text"}
              value={authForm.email}
              onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
              required
            />
          </label>
          {mode === "register" ? (
            <label>
              {tr("Phone", "\u0627\u0644\u0647\u0627\u062a\u0641")}
              <input
                value={authForm.phone}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, phone: event.target.value }))}
                required
              />
            </label>
          ) : null}
          {mode === "register" ? (
            <label>
              {tr("Country", "\u0627\u0644\u062f\u0648\u0644\u0629")}
              <select
                value={authForm.country}
                onChange={(event) => {
                  const nextCountry = event.target.value;
                  setAuthForm((prev) => ({ ...prev, country: nextCountry }));
                  setCurrency(currencyForCountry(nextCountry));
                }}
                required
              >
                <option value="">{tr("Select country", "\u0627\u062e\u062a\u0631 \u0627\u0644\u062f\u0648\u0644\u0629")}</option>
              {COUNTRY_OPTIONS.map((country) => (
                <option key={country.code} value={country.code}>
                  {tr(country.nameEn, country.nameAr)} - {country.currency}
                </option>
              ))}
              </select>
            </label>
          ) : null}
          {mode === "register" ? (
            <label>
              {tr("City", "\u0627\u0644\u0645\u062f\u064a\u0646\u0629")}
              <input
                value={authForm.city}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, city: event.target.value }))}
                placeholder={tr("Optional", "\u0627\u062e\u062a\u064a\u0627\u0631\u064a")}
              />
            </label>
          ) : null}
          {mode === "register" ? (
            <label className="span-2">
              {tr("Address", "\u0627\u0644\u0639\u0646\u0648\u0627\u0646")}
              <input
                value={authForm.address}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, address: event.target.value }))}
                placeholder={tr("Optional until checkout", "\u0627\u062e\u062a\u064a\u0627\u0631\u064a \u062d\u062a\u0649 \u0627\u0644\u062f\u0641\u0639")}
              />
            </label>
          ) : null}
          {mode === "register" ? (
            <label>
              {tr("Gender", "\u0627\u0644\u0646\u0648\u0639")}
              <select
                value={authForm.gender}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, gender: event.target.value }))}
              >
                <option value="">{tr("Prefer not to say", "\u0623\u0641\u0636\u0644 \u0639\u062f\u0645 \u0627\u0644\u0625\u062c\u0627\u0628\u0629")}</option>
                <option value="male">{tr("Male", "\u0630\u0643\u0631")}</option>
                <option value="female">{tr("Female", "\u0623\u0646\u062b\u0649")}</option>
                <option value="other">{tr("Other", "\u0623\u062e\u0631\u0649")}</option>
              </select>
            </label>
          ) : null}
          {mode === "register" ? (
            <label>
              {tr("Birth Date", "\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0645\u064a\u0644\u0627\u062f")}
              <input
                type="date"
                value={authForm.birthDate}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, birthDate: event.target.value }))}
              />
            </label>
          ) : null}
          {mode === "register" ? (
            <StoreAvatarUploadField
              title={tr("Profile Image", "\u0635\u0648\u0631\u0629 \u0627\u0644\u062d\u0633\u0627\u0628")}
              helper={tr("Optional. Upload from your device.", "\u0627\u062e\u062a\u064a\u0627\u0631\u064a. \u0627\u0631\u0641\u0639\u0647\u0627 \u0645\u0646 \u062c\u0647\u0627\u0632\u0643.")}
              name={authForm.name || authForm.email}
              avatarUrl={authForm.avatarUrl}
              isUploading={authAvatarUploading}
              onUpload={uploadAuthAvatar}
              onRemove={() => setAuthForm((prev) => ({ ...prev, avatarUrl: "" }))}
              tr={tr}
            />
          ) : null}
          <label>
            {tr("Password", "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631")}
            <input
              type="password"
              value={authForm.password}
              onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
              required
            />
          </label>
          <button type="submit" className="store-primary-btn span-2" disabled={authSaving}>
            {authSaving ? tr("Please wait...", "\u064a\u0631\u062c\u0649 \u0627\u0644\u0627\u0646\u062a\u0638\u0627\u0631...") : mode === "register" ? tr("Create Account", "\u0625\u0646\u0634\u0627\u0621 \u062d\u0633\u0627\u0628") : tr("Login", "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644")}
          </button>
          <button
            type="button"
            className="store-secondary-btn span-2"
            onClick={() => setMode((prev) => (prev === "register" ? "login" : "register"))}
          >
            {mode === "register" ? tr("Already have account? Login", "\u0644\u062f\u064a\u0643 \u062d\u0633\u0627\u0628 \u0628\u0627\u0644\u0641\u0639\u0644\u061f \u0633\u062c\u0644 \u062f\u062e\u0648\u0644") : tr("Create new account", "\u0625\u0646\u0634\u0627\u0621 \u062d\u0633\u0627\u0628 \u062c\u062f\u064a\u062f")}
          </button>
          <a className="store-secondary-btn span-2" href={googleLink}>
            {tr("Continue with Google", "\u0627\u0644\u0645\u062a\u0627\u0628\u0639\u0629 \u0628\u062d\u0633\u0627\u0628 Google")}
          </a>
          <a className="store-secondary-btn span-2" href={facebookLink}>
            {tr("Continue with Facebook", "\u0627\u0644\u0645\u062a\u0627\u0628\u0639\u0629 \u0628\u062d\u0633\u0627\u0628 Facebook")}
          </a>
        </form>
      )}
    </section>
  );
}

function StoreSocialCallbackPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { applySocialSession, tr } = useStore();

  useEffect(() => {
    async function handleCallback() {
      const params = new URLSearchParams(location.search);
      const token = params.get("token") || "";
      const csrfToken = params.get("csrfToken") || "";
      const nextPath = params.get("next") || "/store/account";
      if (!token) {
        toast.error(tr("Social login callback is invalid.", "\u0627\u0633\u062a\u062c\u0627\u0628\u0629 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0627\u0644\u0627\u062c\u062a\u0645\u0627\u0639\u064a \u063a\u064a\u0631 \u0635\u0627\u0644\u062d\u0629."));
        navigate("/store/account", { replace: true });
        return;
      }
      try {
        await applySocialSession(token, csrfToken);
        toast.success(tr("Social login completed.", "\u0627\u0643\u062a\u0645\u0644 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0627\u0644\u0627\u062c\u062a\u0645\u0627\u0639\u064a."));
      } catch (error) {
        toast.error(error?.response?.data?.error || tr("Could not complete social login.", "\u062a\u0639\u0630\u0631 \u0625\u0643\u0645\u0627\u0644 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0627\u0644\u0627\u062c\u062a\u0645\u0627\u0639\u064a."));
      } finally {
        navigate(nextPath, { replace: true });
      }
    }
    void handleCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, navigate]);

  return (
    <section className="store-section">
      <p>{tr("Completing social login...", "\u062c\u0627\u0631\u064d \u0625\u0643\u0645\u0627\u0644 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0627\u0644\u0627\u062c\u062a\u0645\u0627\u0639\u064a...")}</p>
    </section>
  );
}

function StoreSupportPage() {
  const {
    createSupportTicket,
    supportTickets,
    supportStats,
    replyToSupportTicket,
    isCustomerAuthenticated,
    meta,
    tr,
  } = useStore();
  const [saving, setSaving] = useState(false);
  const [replyingTicketId, setReplyingTicketId] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    orderNumber: "",
    subject: "",
    message: "",
  });

  async function submitTicket(event) {
    event.preventDefault();
    if (saving) {
      return;
    }
    setSaving(true);
    try {
      await createSupportTicket(form);
      setForm({
        name: "",
        email: "",
        phone: "",
        orderNumber: "",
        subject: "",
        message: "",
      });
      toast.success(tr("Support ticket sent successfully.", "\u062a\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u062f\u0639\u0645 \u0628\u0646\u062c\u0627\u062d."));
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Could not send support ticket.", "\u062a\u0639\u0630\u0631 \u0625\u0631\u0633\u0627\u0644 \u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u062f\u0639\u0645."));
    } finally {
      setSaving(false);
    }
  }

  async function submitReply(ticketId) {
    if (!replyMessage.trim()) {
      return;
    }
    setReplyingTicketId(ticketId);
    try {
      await replyToSupportTicket(ticketId, replyMessage);
      setReplyMessage("");
      toast.success(tr("Reply sent.", "\u062a\u0645 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0631\u062f."));
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message || tr("Reply failed.", "\u0641\u0634\u0644 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0631\u062f."));
    } finally {
      setReplyingTicketId("");
    }
  }

  return (
    <div className="store-stack">
      <section className="store-section">
        <div className="store-section-head">
          <h2>{tr("Customer Support", "\u062f\u0639\u0645 \u0627\u0644\u0639\u0645\u0644\u0627\u0621")}</h2>
          <p>{tr("Submit complaints, shipping issues, or general questions.", "\u0623\u0631\u0633\u0644 \u0634\u0643\u0648\u0649 \u0623\u0648 \u0645\u0634\u0643\u0644\u0629 \u0634\u062d\u0646 \u0623\u0648 \u0623\u064a \u0627\u0633\u062a\u0641\u0633\u0627\u0631 \u0639\u0627\u0645.")}</p>
        </div>
        <StoreSocialButtons socialLinks={meta?.socialLinks} tr={tr} />
        <form className="store-checkout-form" onSubmit={submitTicket}>
          {!isCustomerAuthenticated ? (
            <>
              <label>
                {tr("Name", "\u0627\u0644\u0627\u0633\u0645")}
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </label>
              <label>
                {tr("Email", "\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a")}
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  required
                />
              </label>
            </>
          ) : null}
          <label>
            {tr("Phone", "\u0627\u0644\u0647\u0627\u062a\u0641")}
            <input
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
          </label>
          <label>
            {tr("Order Number", "\u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628")}
            <input
              value={form.orderNumber}
              onChange={(event) => setForm((prev) => ({ ...prev, orderNumber: event.target.value }))}
            />
          </label>
          <label className="span-2">
            {tr("Subject", "\u0627\u0644\u0639\u0646\u0648\u0627\u0646")}
            <input
              value={form.subject}
              onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
              required
            />
          </label>
          <label className="span-2">
            {tr("Message", "\u0627\u0644\u0631\u0633\u0627\u0644\u0629")}
            <textarea
              value={form.message}
              onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
              required
            />
          </label>
          <button type="submit" className="store-primary-btn span-2" disabled={saving}>
            {saving ? tr("Sending...", "\u062c\u0627\u0631\u064d \u0627\u0644\u0625\u0631\u0633\u0627\u0644...") : tr("Send Ticket", "\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0637\u0644\u0628")}
          </button>
        </form>
      </section>

      {isCustomerAuthenticated ? (
        <section className="store-section">
          <div className="store-section-head">
            <h2>{tr("My Tickets", "\u062a\u0630\u0627\u0643\u0631\u064a")}</h2>
            <p>
              {tr("Open", "\u0645\u0641\u062a\u0648\u062d")}: {supportStats?.open || 0} | {tr("In Progress", "\u062c\u0627\u0631\u064d \u0627\u0644\u0645\u062a\u0627\u0628\u0639\u0629")}: {supportStats?.inProgress || 0} | {tr("Resolved", "\u062a\u0645 \u062d\u0644\u0647")}: {supportStats?.resolved || 0}
            </p>
          </div>
          <div className="support-ticket-list">
            {supportTickets.length === 0 ? (
              <p>{tr("No tickets yet.", "\u0644\u0627 \u062a\u0648\u062c\u062f \u062a\u0630\u0627\u0643\u0631 \u0628\u0639\u062f.")}</p>
            ) : (
              supportTickets.map((ticket) => (
                <article key={ticket.id}>
                  <h4>
                    {ticket.subject} <span>{ticket.status}</span>
                  </h4>
                  <p>{tr("Order", "\u0627\u0644\u0637\u0644\u0628")}: {ticket.orderNumber || "-"}</p>
                  <div className="support-messages">
                    {(ticket.messages || []).slice(0, 4).map((message) => (
                      <div key={message.id}>
                        <strong>{message.senderName}</strong>
                        <p>{message.body}</p>
                      </div>
                    ))}
                  </div>
                  <div className="support-reply-row">
                    <input
                      value={replyingTicketId === ticket.id ? replyMessage : ""}
                      onChange={(event) => {
                        setReplyingTicketId(ticket.id);
                        setReplyMessage(event.target.value);
                      }}
                      placeholder={tr("Reply to support", "\u0627\u0643\u062a\u0628 \u0631\u062f\u0643 \u0644\u0644\u062f\u0639\u0645")}
                    />
                    <button
                      type="button"
                      className="store-secondary-btn"
                      onClick={() => submitReply(ticket.id)}
                      disabled={replyingTicketId === ticket.id && !replyMessage.trim()}
                    >
                      {tr("Reply", "\u0631\u062f")}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function StoreSuccessPage() {
  const location = useLocation();
  const { orderNumber } = useParams();
  const { formatPrice, tr } = useStore();
  const order = location.state?.order;
  const customerName = location.state?.customerName || tr("Customer", "\u0627\u0644\u0639\u0645\u064a\u0644");

  return (
    <section className="store-section success-state">
      <BadgeCheck size={34} />
      <h2>{tr("Order Confirmed", "\u062a\u0645 \u062a\u0623\u0643\u064a\u062f \u0627\u0644\u0637\u0644\u0628")}</h2>
      <p>
        {tr("Thank you", "\u0634\u0643\u0631\u0627 \u0644\u0643")} {customerName}. {tr("Your order number is", "\u0631\u0642\u0645 \u0637\u0644\u0628\u0643 \u0647\u0648")} <strong>{orderNumber}</strong>.
      </p>
      <p>
        {tr("Submitted at", "\u062a\u0645 \u0627\u0644\u0625\u0631\u0633\u0627\u0644 \u0641\u064a")}: {order?.createdAt ? formatDateTime(order.createdAt) : tr("just now", "\u0627\u0644\u0622\u0646")} | {tr("Total", "\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a")}:{" "}
        {formatPrice(Number(order?.total || 0))}
      </p>
      <p>
        {tr("Payment", "\u0627\u0644\u062f\u0641\u0639")}: {String(order?.paymentMethod || "cash_on_delivery").replace(/_/g, " ")} | {tr("Status", "\u0627\u0644\u062d\u0627\u0644\u0629")}:{" "}
        {order?.paymentStatus || "pending_collection"}
      </p>
      <div className="store-hero-actions">
        <Link to="/store/products" className="store-primary-btn">
          {tr("Continue Shopping", "\u0645\u062a\u0627\u0628\u0639\u0629 \u0627\u0644\u062a\u0633\u0648\u0642")}
        </Link>
        <Link to="/store/account" className="store-secondary-btn">
          {tr("My Account", "\u062d\u0633\u0627\u0628\u064a")}
        </Link>
      </div>
    </section>
  );
}

function StoreShell() {
  const { theme } = useStore();
  return (
    <div className={`store-shell ${theme === "dark" ? "theme-dark" : "theme-light"}`}>
      <Toaster position="top-right" />
      <Routes>
        <Route element={<StoreLayout />}>
          <Route index element={<StoreHomePage />} />
          <Route path="products" element={<StoreProductsPage />} />
          <Route path="products/:productId" element={<StoreProductDetailsPage />} />
          <Route path="cart" element={<StoreCartPage />} />
          <Route
            path="checkout"
            element={(
              <RequireCustomerAccount>
                <StoreCheckoutPage />
              </RequireCustomerAccount>
            )}
          />
          <Route
            path="payment"
            element={(
              <RequireCustomerAccount>
                <StorePaymentPage />
              </RequireCustomerAccount>
            )}
          />
          <Route path="support" element={<StoreSupportPage />} />
          <Route path="account" element={<StoreAccountPage />} />
          <Route path="auth/callback" element={<StoreSocialCallbackPage />} />
          <Route path="success/:orderNumber" element={<StoreSuccessPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/store" replace />} />
      </Routes>
    </div>
  );
}

export default function StoreApp() {
  return (
    <StoreProvider>
      <StoreShell />
    </StoreProvider>
  );
}



