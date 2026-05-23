import { useEffect, useMemo, useState } from "react";
import { motion as Motion } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import {
  BarChart3,
  Bot,
  Contact,
  FileText,
  MessageCircle,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Settings,
  Truck,
  Users,
  Tag,
} from "lucide-react";
import api from "./lib/api";
import { useAuth } from "./context/useAuth";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import DashboardSection from "./sections/DashboardSection";
import SalesSection from "./sections/SalesSection";
import ContactsSection from "./sections/ContactsSection";
import ProductsSection from "./sections/ProductsSection";
import ShippingSection from "./sections/ShippingSection";
import ProfitsSection from "./sections/ProfitsSection";
import UsersSection from "./sections/UsersSection";
import LogsSection from "./sections/LogsSection";
import OnlineOrdersSection from "./sections/OnlineOrdersSection";
import SupportSection from "./sections/SupportSection";
import StoreSettingsSection from "./sections/StoreSettingsSection";
import AgentSection from "./sections/AgentSection";
import CouponsSection from "./sections/CouponsSection";
import "./App.css";

const THEME_KEY = "c2a_lap_theme_v1";
const ADMIN_LANG_KEY = "c2a_lap_admin_lang_v1";

function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || "light";
  } catch {
    return "light";
  }
}

function readAdminLanguage() {
  try {
    const saved = localStorage.getItem(ADMIN_LANG_KEY);
    if (saved === "ar" || saved === "en") {
      return saved;
    }
  } catch {
    // Ignore read issues.
  }

  if (typeof navigator !== "undefined" && String(navigator.language || "").toLowerCase().startsWith("ar")) {
    return "ar";
  }
  return "en";
}

const emptyOverview = {
  kpis: {},
  charts: { monthlyProfit: [], employeePerformance: [] },
};

function LoginView({ lang, onToggleLanguage }) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const isArabic = lang === "ar";
  const tr = (en, ar) => (isArabic ? ar : en);

  async function onSubmit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      toast.success(tr("Signed in successfully.", "تم تسجيل الدخول بنجاح."));
    } catch (error) {
      toast.error(error?.response?.data?.error || tr("Invalid login.", "بيانات تسجيل الدخول غير صحيحة."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <Motion.section className="login-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
        <div className="login-lang-row">
          <button type="button" className="secondary-btn" onClick={onToggleLanguage}>
            {isArabic ? "EN" : "AR"}
          </button>
        </div>
        <p className="login-brand">C2A LAP</p>
        <h1>{tr("Sales Management System", "نظام إدارة المبيعات")}</h1>
        <p className="login-sub">{tr("Secure workspace for admin and sales teams.", "مساحة عمل آمنة لفريق الإدارة والمبيعات.")}</p>

        <form onSubmit={onSubmit} className="login-form">
          <label>
            {tr("Username", "اسم المستخدم")}
            <input value={username} onChange={(event) => setUsername(event.target.value)} required />
          </label>
          <label>
            {tr("Password", "كلمة المرور")}
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? tr("Signing in...", "جارٍ تسجيل الدخول...") : tr("Login", "تسجيل الدخول")}
          </button>
        </form>
      </Motion.section>
    </main>
  );
}

export default function App() {
  const { user, isAuthenticated, logout, setUser } = useAuth();

  const [theme, setTheme] = useState(() => readTheme());
  const [lang, setLang] = useState(() => readAdminLanguage());
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const isArabic = lang === "ar";
  const tr = (en, ar) => (isArabic ? ar : en);
  const isAdmin = user?.role === "admin";
  const isProductsManager = user?.role === "products";
  const canViewSalesWorkspace = isAdmin || user?.role === "sales";
  const canManageProducts = isAdmin || isProductsManager;
  const canBrowseProducts = canManageProducts || user?.role === "sales";

  const [overview, setOverview] = useState(emptyOverview);
  const [sales, setSales] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [products, setProducts] = useState([]);
  const [shippingCompanies, setShippingCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [profitSummary, setProfitSummary] = useState(null);
  const [onlineOrders, setOnlineOrders] = useState([]);
  const [onlineAnalytics, setOnlineAnalytics] = useState(null);
  const [supportTickets, setSupportTickets] = useState([]);
  const [supportStats, setSupportStats] = useState(null);
  const [storeSettings, setStoreSettings] = useState(null);
  const [coupons, setCoupons] = useState([]);

  const [salesFilters, setSalesFilters] = useState({
    dateFrom: "",
    dateTo: "",
    brand: "",
    employee: "",
    warrantyStatus: "",
    query: "",
  });

  const [contactQuery, setContactQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [onlineFilters, setOnlineFilters] = useState({
    status: "",
    query: "",
    city: "",
    dateFrom: "",
    dateTo: "",
  });
  const [supportFilters, setSupportFilters] = useState({
    status: "",
    query: "",
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Ignore storage write issues.
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = isArabic ? "ar" : "en";
    document.documentElement.dir = isArabic ? "rtl" : "ltr";
    try {
      localStorage.setItem(ADMIN_LANG_KEY, lang);
    } catch {
      // Ignore storage write issues.
    }
  }, [lang, isArabic]);

  const navItems = useMemo(() => {
    const base = [];

    if (canViewSalesWorkspace) {
      base.push({ key: "dashboard", label: tr("Dashboard", "\u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u062d\u0643\u0645"), icon: LayoutDashboard });
      base.push({ key: "sales", label: tr("Sales", "\u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a"), icon: BarChart3 });
      base.push({ key: "contacts", label: tr("Contacts", "\u0627\u0644\u0639\u0645\u0644\u0627\u0621"), icon: Contact });
      base.push({ key: "products", label: tr("Products", "\u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a"), icon: Package });
      base.push({ key: "shipping", label: tr("Shipping", "\u0627\u0644\u0634\u062d\u0646"), icon: Truck });
    } else if (canManageProducts) {
      base.push({ key: "products", label: tr("Products", "\u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a"), icon: Package });
    }

    if (isAdmin) {
      base.push({ key: "profits", label: tr("Profits", "\u0627\u0644\u0623\u0631\u0628\u0627\u062d"), icon: FileText });
      base.push({
        key: "onlineOrders",
        label: tr("Online Orders", "\u0627\u0644\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a\u0629"),
        icon: ShoppingCart,
      });
      base.push({ key: "coupons", label: tr("Coupons", "الكوبونات"), icon: Tag });
      base.push({ key: "agent", label: tr("Agent", "\u0627\u0644\u0625\u062c\u0646\u062a"), icon: Bot });
      base.push({ key: "storeSettings", label: tr("Store Settings", "\u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u0645\u062a\u062c\u0631"), icon: Settings });
      base.push({ key: "support", label: tr("Support", "\u0627\u0644\u062f\u0639\u0645"), icon: MessageCircle });
      base.push({ key: "users", label: tr("Users", "\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u0648\u0646"), icon: Users });
      base.push({ key: "logs", label: tr("Logs", "\u0627\u0644\u0633\u062c\u0644\u0627\u062a"), icon: Settings });
    }

    return base;
  }, [canManageProducts, canViewSalesWorkspace, isAdmin, isArabic]);

  useEffect(() => {
    if (navItems.length === 0) {
      return;
    }
    if (!navItems.some((item) => item.key === activeTab)) {
      setActiveTab(navItems[0].key);
    }
  }, [activeTab, navItems]);

  const brandDistribution = useMemo(() => {
    const map = sales.reduce((acc, sale) => {
      acc[sale.brand] = (acc[sale.brand] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [sales]);

  async function refreshAll() {
    if (!isAuthenticated) {
      return;
    }

    setLoading(true);
    try {
      const params = {
        ...salesFilters,
      };

      const tasks = [{ key: "notifications", request: api.get("/system/notifications") }];

      if (canViewSalesWorkspace) {
        tasks.push({ key: "overview", request: api.get("/dashboard/overview", { params }), required: true });
        tasks.push({ key: "sales", request: api.get("/sales", { params }), required: true });
        tasks.push({ key: "contacts", request: api.get("/contacts", { params: { query: contactQuery } }) });
        tasks.push({ key: "shipping", request: api.get("/shipping") });
      }

      if (canBrowseProducts) {
        tasks.push({ key: "products", request: api.get("/products", { params: { query: productQuery } }) });
      }

      if (isAdmin) {
        tasks.push({ key: "users", request: api.get("/users") });
        tasks.push({ key: "profits", request: api.get("/profits/summary", { params }) });
        tasks.push({ key: "logs", request: api.get("/logs", { params: { limit: 200 } }) });
        tasks.push({
          key: "onlineOrders",
          request: api.get("/online-orders", { params: onlineFilters }),
        });
        tasks.push({
          key: "support",
          request: api.get("/support/tickets", { params: supportFilters }),
        });
        tasks.push({ key: "storeSettings", request: api.get("/store-settings") });
        tasks.push({ key: "coupons", request: api.get("/coupons") });
      }

      const settled = await Promise.allSettled(tasks.map((task) => task.request));
      const dataByKey = {};
      const optionalFailures = [];

      for (let index = 0; index < tasks.length; index += 1) {
        const task = tasks[index];
        const result = settled[index];

        if (result.status === "fulfilled") {
          dataByKey[task.key] = result.value.data;
          continue;
        }

        const status = result.reason?.response?.status;
        const reason = result.reason?.response?.data?.error || result.reason?.message || "Unknown error";
        if (status === 401) {
          const authError = new Error(`${task.key}: ${reason}`);
          authError.status = 401;
          throw authError;
        }

        if (task.required) {
          const requiredError = new Error(`${task.key}: ${reason}`);
          requiredError.status = status;
          throw requiredError;
        }
        optionalFailures.push(`${task.key}: ${reason}`);
      }

      setOverview(dataByKey.overview || emptyOverview);
      setSales(dataByKey.sales?.sales || []);
      setContacts(dataByKey.contacts?.contacts || []);
      setProducts(dataByKey.products?.products || []);
      setShippingCompanies(dataByKey.shipping?.shippingCompanies || []);
      setNotifications(dataByKey.notifications?.notifications || []);

      if (isAdmin) {
        setUsers(dataByKey.users?.users || []);
        setProfitSummary(dataByKey.profits?.summary || null);
        setLogs(dataByKey.logs?.logs || []);
        setOnlineOrders(dataByKey.onlineOrders?.orders || []);
        setOnlineAnalytics(dataByKey.onlineOrders?.analytics || null);
        setSupportTickets(dataByKey.support?.tickets || []);
        setSupportStats(dataByKey.support?.stats || null);
        setStoreSettings(dataByKey.storeSettings?.storeSettings || null);
        setCoupons(dataByKey.coupons?.coupons || []);
      } else {
        setUsers([]);
        setProfitSummary(null);
        setLogs([]);
        setOnlineOrders([]);
        setOnlineAnalytics(null);
        setSupportTickets([]);
        setSupportStats(null);
        setStoreSettings(null);
        setCoupons([]);
      }

      if (optionalFailures.length > 0) {
        toast.error(
          isArabic
            ? `\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0628\u0639\u0636 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a: ${optionalFailures[0]}`
            : `Some dashboard data failed: ${optionalFailures[0]}`,
        );
      }
    } catch (error) {
      if (error?.status === 401 || error?.response?.status === 401) {
        logout();
        toast.error(
          tr(
            "Session expired. Please login again.",
            "\u0627\u0646\u062a\u0647\u062a \u0627\u0644\u062c\u0644\u0633\u0629. \u0633\u062c\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.",
          ),
        );
      } else {
        toast.error(
          error?.response?.data?.error ||
            error?.message ||
            tr("Could not refresh dashboard.", "\u062a\u0639\u0630\u0631 \u062a\u062d\u062f\u064a\u062b \u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u062d\u0643\u0645."),
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshAll();
    const timer = setInterval(() => {
      void refreshAll();
    }, 45000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isAuthenticated,
    isAdmin,
    canBrowseProducts,
    canViewSalesWorkspace,
    contactQuery,
    productQuery,
    JSON.stringify(salesFilters),
    JSON.stringify(onlineFilters),
    JSON.stringify(supportFilters),
  ]);

  async function createSale(payload) {
    await api.post("/sales", payload);
    await refreshAll();
  }

  async function createContact(payload) {
    await api.post("/contacts", payload);
    await refreshAll();
  }

  async function createProduct(payload) {
    const response = await api.post("/products", payload);
    await refreshAll();
    return response.data?.product || null;
  }

  async function updateProduct(productId, payload) {
    const response = await api.put(`/products/${productId}`, payload);
    await refreshAll();
    return response.data?.product || null;
  }

  async function uploadProductImages(productId, files) {
    const formData = new FormData();
    for (const file of files) {
      formData.append("images", file);
    }
    await api.post(`/products/${productId}/images`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    await refreshAll();
  }

  async function uploadExcel(file) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/products/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    await refreshAll();
    return {
      importedCount: response.data.importedCount || 0,
      skippedCount: response.data.skippedCount || 0,
    };
  }

  async function clearProducts() {
    const response = await api.delete("/products/all");
    await refreshAll();
    return response.data.removedCount || 0;
  }

  async function deleteProduct(productId) {
    await api.delete(`/products/${productId}`);
    await refreshAll();
  }

  async function createShipping(payload) {
    await api.post("/shipping", payload);
    await refreshAll();
  }

  async function getBostaHealth() {
    const response = await api.get("/shipping/providers/bosta/health");
    return response.data?.health || null;
  }

  async function syncBostaStatus(orderId) {
    const response = await api.post(`/shipping/providers/bosta/orders/${orderId}/sync-status`);
    await refreshAll();
    return response.data;
  }

  async function createBostaShipment(orderId, payload = {}) {
    const response = await api.post(`/shipping/providers/bosta/orders/${orderId}/create-shipment`, payload);
    await refreshAll();
    return response.data;
  }

  async function createUser(payload) {
    await api.post("/users", payload);
    await refreshAll();
  }

  async function updateUser(userId, payload) {
    const response = await api.put(`/users/${userId}`, payload);
    if (response.data?.user?.id === user?.id) {
      setUser(response.data.user);
    }
    await refreshAll();
    return response.data?.user;
  }

  async function deleteUser(userId) {
    await api.delete(`/users/${userId}`);
    await refreshAll();
  }

  async function uploadUserAvatar(file) {
    const formData = new FormData();
    formData.append("avatar", file);
    const response = await api.post("/users/avatar-upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data?.avatarUrl || "";
  }

  async function createCoupon(payload) {
    await api.post("/coupons", payload);
    await refreshAll();
  }

  async function updateCoupon(couponId, payload) {
    await api.put(`/coupons/${couponId}`, payload);
    await refreshAll();
  }

  async function deleteCoupon(couponId) {
    await api.delete(`/coupons/${couponId}`);
    await refreshAll();
  }

  function openProductFromDashboard(product) {
    const queryText = String(product?.laptopName || product?.brand || "").trim();
    setProductQuery(queryText);
    setActiveTab("products");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function exportReport(type) {
    const response = await api.get(`/reports/${type}`, {
      responseType: "blob",
      params: salesFilters,
    });

    const extension = type === "excel" ? "xlsx" : "pdf";
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `c2a-report-${Date.now()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  async function clearProfits() {
    const response = await api.delete("/profits/clear", {
      params: salesFilters,
    });
    await refreshAll();
    return response.data?.clearedCount || 0;
  }

  async function updateOnlineOrder(orderId, payload) {
    await api.put(`/online-orders/${orderId}`, payload);
    await refreshAll();
  }

  async function updateSupportTicket(ticketId, payload) {
    await api.put(`/support/tickets/${ticketId}`, payload);
    await refreshAll();
  }

  async function replySupportTicket(ticketId, message) {
    await api.post(`/support/tickets/${ticketId}/messages`, { message });
    await refreshAll();
  }

  async function generateProductDraft(payload) {
    const response = await api.post("/agent/products/draft", payload);
    return response.data?.draft || null;
  }

  async function importProductsViaAgent(file) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/agent/products/import-excel", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    await refreshAll();
    return response.data;
  }

  async function generateSupportReply(ticketId) {
    const response = await api.post(`/agent/support/tickets/${ticketId}/reply-draft`);
    return response.data?.suggestion || null;
  }

  async function autoReplySupportTicket(ticketId, message) {
    const response = await api.post(`/agent/support/tickets/${ticketId}/auto-reply`, { message });
    await refreshAll();
    return response.data?.ticket || null;
  }

  async function generateShippingDraft(orderId) {
    const response = await api.post(`/agent/orders/${orderId}/shipping-draft`);
    return response.data?.draft || null;
  }

  async function saveStoreSettings(payload) {
    await api.put("/store-settings", payload);
    await refreshAll();
  }

  async function sendTestEmail(payload) {
    const response = await api.post("/system/email/test", payload);
    return response.data;
  }

  if (!isAuthenticated) {
    return (
      <>
        <Toaster position="top-right" />
        <LoginView lang={lang} onToggleLanguage={() => setLang((prev) => (prev === "ar" ? "en" : "ar"))} />
      </>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      <div className="dashboard-layout">
        <Sidebar items={navItems} activeTab={activeTab} onSelect={setActiveTab} user={user} lang={lang} />

        <main className="main-content">
          <Topbar
            user={user}
            lang={lang}
            theme={theme}
            onToggleTheme={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
            onToggleLanguage={() => setLang((prev) => (prev === "ar" ? "en" : "ar"))}
            onLogout={logout}
            notifications={notifications}
            loading={loading}
          />

          <Motion.div
            className="page-content"
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {activeTab === "dashboard" && canViewSalesWorkspace ? (
              <DashboardSection
                overview={overview}
                isAdmin={isAdmin}
                lang={lang}
                onOpenProduct={openProductFromDashboard}
                onRefresh={refreshAll}
              />
            ) : null}

            {activeTab === "sales" && canViewSalesWorkspace ? (
              <SalesSection
                sales={sales}
                products={products}
                shippingCompanies={shippingCompanies}
                users={users}
                filters={salesFilters}
                onFiltersChange={setSalesFilters}
                onCreateSale={createSale}
                canViewFinance={isAdmin}
                role={user.role}
                lang={lang}
              />
            ) : null}

            {activeTab === "contacts" && canViewSalesWorkspace ? (
              <ContactsSection
                contacts={contacts}
                onCreateContact={createContact}
                onSearch={setContactQuery}
                query={contactQuery}
                lang={lang}
              />
            ) : null}

            {activeTab === "products" && canBrowseProducts ? (
              <ProductsSection
                role={user.role}
                products={products}
                query={productQuery}
                onSearch={setProductQuery}
                onCreateProduct={createProduct}
                onUpdateProduct={updateProduct}
                onUploadProductImages={uploadProductImages}
                onUploadExcel={uploadExcel}
                onClearProducts={clearProducts}
                onDeleteProduct={deleteProduct}
                lang={lang}
              />
            ) : null}

            {activeTab === "shipping" && canViewSalesWorkspace ? (
              <ShippingSection
                role={user.role}
                shippingCompanies={shippingCompanies}
                onCreateShipping={createShipping}
                onRefreshBostaHealth={getBostaHealth}
                onSyncBostaStatus={syncBostaStatus}
                lang={lang}
              />
            ) : null}

            {activeTab === "profits" && isAdmin ? (
              <ProfitsSection
                summary={profitSummary}
                brandData={brandDistribution}
                onExportExcel={() => exportReport("excel")}
                onExportPdf={() => exportReport("pdf")}
                onClearProfits={clearProfits}
                lang={lang}
              />
            ) : null}

            {activeTab === "onlineOrders" && isAdmin ? (
              <OnlineOrdersSection
                orders={onlineOrders}
                analytics={onlineAnalytics}
                users={users}
                filters={onlineFilters}
                onFiltersChange={setOnlineFilters}
                onUpdateOrder={updateOnlineOrder}
                onCreateBostaShipment={createBostaShipment}
                lang={lang}
              />
            ) : null}

            {activeTab === "agent" && isAdmin ? (
              <AgentSection
                tickets={supportTickets}
                orders={onlineOrders}
                settings={storeSettings?.agentSettings}
                onGenerateProductDraft={generateProductDraft}
                onImportExcel={importProductsViaAgent}
                onCreateProduct={createProduct}
                onUploadProductImages={uploadProductImages}
                onGenerateSupportReply={generateSupportReply}
                onAutoReplyTicket={autoReplySupportTicket}
                onReplyTicket={replySupportTicket}
                onUpdateTicket={updateSupportTicket}
                onUpdateOrder={updateOnlineOrder}
                onGenerateShippingDraft={generateShippingDraft}
                onCreateBostaShipment={createBostaShipment}
                lang={lang}
                onSelectTab={(tab) => {
                  setActiveTab(tab);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            ) : null}

            {activeTab === "storeSettings" && isAdmin ? (
              <StoreSettingsSection
                settings={storeSettings}
                onSave={saveStoreSettings}
                onSendTestEmail={sendTestEmail}
                lang={lang}
              />
            ) : null}

            {activeTab === "support" && isAdmin ? (
              <SupportSection
                tickets={supportTickets}
                stats={supportStats}
                users={users}
                filters={supportFilters}
                onFiltersChange={setSupportFilters}
                onUpdateTicket={updateSupportTicket}
                onReplyTicket={replySupportTicket}
                lang={lang}
              />
            ) : null}

            {activeTab === "users" && isAdmin ? (
              <UsersSection
                users={users}
                onCreateUser={createUser}
                onUpdateUser={updateUser}
                onDeleteUser={deleteUser}
                onUploadAvatar={uploadUserAvatar}
                lang={lang}
              />
            ) : null}

            {activeTab === "coupons" && isAdmin ? (
              <CouponsSection
                coupons={coupons}
                onCreateCoupon={createCoupon}
                onUpdateCoupon={updateCoupon}
                onDeleteCoupon={deleteCoupon}
                lang={lang}
              />
            ) : null}

            {activeTab === "logs" && isAdmin ? <LogsSection logs={logs} lang={lang} /> : null}
          </Motion.div>
        </main>
      </div>
    </>
  );
}



