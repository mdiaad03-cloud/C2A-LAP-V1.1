$ErrorActionPreference = "Stop"

$filePath = "c:\Users\mdiaa\Desktop\Bua\semester 2\Data seicens\vs_py\c2a-lap\client\src\store\StoreApp.jsx"
$lines = Get-Content -Path $filePath

function Replace-Lines {
  param(
    [string[]]$Source,
    [string]$StartMarker,
    [string]$EndMarker,
    [string[]]$Replacement
  )

  $start = [Array]::IndexOf($Source, $StartMarker)
  $end = [Array]::IndexOf($Source, $EndMarker)
  if ($start -lt 0 -or $end -lt 0 -or $end -le $start) {
    throw "Could not replace block from [$StartMarker] to [$EndMarker]"
  }

  $before = if ($start -gt 0) { $Source[0..($start - 1)] } else { @() }
  $after = $Source[$end..($Source.Length - 1)]
  return @($before + $Replacement + $after)
}

$countryBlock = @'
const COUNTRY_OPTIONS = [
  { code: "EG", nameEn: "Egypt", nameAr: "مصر", currency: "EGP" },
  { code: "SA", nameEn: "Saudi Arabia", nameAr: "السعودية", currency: "SAR" },
  { code: "AE", nameEn: "United Arab Emirates", nameAr: "الإمارات", currency: "AED" },
  { code: "QA", nameEn: "Qatar", nameAr: "قطر", currency: "QAR" },
  { code: "KW", nameEn: "Kuwait", nameAr: "الكويت", currency: "KWD" },
  { code: "BH", nameEn: "Bahrain", nameAr: "البحرين", currency: "BHD" },
  { code: "OM", nameEn: "Oman", nameAr: "عمان", currency: "OMR" },
];
'@ -split "`r?`n"

$lines = Replace-Lines -Source $lines -StartMarker 'const COUNTRY_OPTIONS = [' -EndMarker 'const StoreContext = createContext(null);' -Replacement $countryBlock

$adaptiveBlock = @'
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

  const widthByProfile = {
    detail: { portrait: "64%", square: "84%", landscape: "100%" },
    slide: { portrait: "58%", square: "76%", landscape: "100%" },
    card: { portrait: "66%", square: "82%", landscape: "100%" },
    compact: { portrait: "58%", square: "72%", landscape: "100%" },
    default: { portrait: "66%", square: "82%", landscape: "100%" },
  };

  const widthMap = widthByProfile[profile] || widthByProfile.default;
  const style = {
    width: widthMap[orientation],
    maxWidth: "100%",
    height: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    objectPosition: "center",
    margin: "0 auto",
    display: "block",
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
'@ -split "`r?`n"

$lines = Replace-Lines -Source $lines -StartMarker 'function StoreAdaptiveImage({ src, alt, className = "", profile = "default" }) {' -EndMarker 'function getInitials(name) {' -Replacement $adaptiveBlock

$homeBlock = @'
function StoreHomePage() {
  const { products, meta, addToCart, loading, error, tr, formatPrice } = useStore();
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
        question: tr("Do you offer installment plans?", "هل توفرون أنظمة تقسيط؟"),
        answer: tr(
          "Yes. Flexible installment options are available through supported payment providers.",
          "نعم، نوفر خيارات تقسيط مرنة عبر وسائل الدفع المدعومة داخل المتجر.",
        ),
      },
      {
        id: "02",
        question: tr("Do you have a showroom?", "هل لديكم مقر فعلي؟"),
        answer: tr(
          "We operate online and coordinate customer service and order support through our team.",
          "نحن نعمل أونلاين مع فريق خدمة عملاء ومتابعة طلبات منظم طوال الوقت.",
        ),
      },
      {
        id: "03",
        question: tr("What about warranty?", "ماذا عن الضمان؟"),
        answer: tr(
          "Warranty coverage depends on the product page and order status updates.",
          "تغطية الضمان تعتمد على صفحة المنتج وتحديثات حالة الطلب بعد التسليم.",
        ),
      },
      {
        id: "04",
        question: tr("How long does delivery take?", "كم تستغرق مدة التوصيل؟"),
        answer: tr(
          "Delivery time depends on city and shipping company and is shown during checkout.",
          "مدة التوصيل تختلف حسب المدينة وشركة الشحن، وتظهر لك أثناء إتمام الطلب.",
        ),
      },
    ];
  }, [content.faqItems, tr]);

  const slides = featured.length > 0 ? featured.slice(0, 3) : products.slice(0, 3);
  const spotlight = featured[0] || products[0] || null;
  const featuredList = (featured.length > 1 ? featured.slice(1, 5) : products.slice(1, 5)).filter(Boolean);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) {
      return undefined;
    }
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="store-stack">
      <section className="store-hero">
        <div className="store-hero-text">
          <p className="store-eyebrow">{content.heroBadge || tr("C2A LAP E-commerce", "متجر C2A LAP")}</p>
          <h1>{content.heroTitle || tr("Premium laptops, synchronized with real-time inventory.", "لابتوبات احترافية مرتبطة بالمخزون لحظيًا.")}</h1>
          <p>
            {content.heroSubtitle || tr(
              "Browse powerful devices, place orders instantly, and track every purchase through secure checkout.",
              "تصفح أجهزة قوية واطلب مباشرة وتابع كل عملية شراء من خلال تجربة دفع آمنة.",
            )}
          </p>
          <div className="store-hero-actions">
            <Link className="store-primary-btn" to="/store/products">
              {content.primaryCtaLabel || tr("Shop Laptops", "تسوق اللابتوبات")}
              <ArrowRight size={16} />
            </Link>
            <Link className="store-secondary-btn" to="/store/cart">
              {content.secondaryCtaLabel || tr("Go To Cart", "اذهب إلى السلة")}
            </Link>
          </div>
        </div>

        <div className="store-hero-slider">
          {slides.length === 0 ? (
            <div className="store-hero-empty">
              {loading ? tr("Loading catalog...", "جاري تحميل المنتجات...") : tr("No products available.", "لا توجد منتجات حاليًا.")}
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
                <Link to={`/store/products/${slides[activeSlide].id}`} className="store-slide-card store-slide-card-link">
                  <StoreAdaptiveImage
                    src={productImages(slides[activeSlide])[0]}
                    alt={slides[activeSlide].laptopName}
                    profile="slide"
                  />
                  <div>
                    <p>{slides[activeSlide].brand}</p>
                    <h3>{slides[activeSlide].laptopName}</h3>
                    <span>{formatPrice(Number(slides[activeSlide].discountedPrice || 0))}</span>
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
            <p className="store-eyebrow">{tr("Shop By Brand", "تسوق حسب العلامة التجارية")}</p>
            <h3>{content.brandsTitle || tr("Popular Brands", "أشهر الماركات")}</h3>
          </div>
          <Link to="/store/products" className="store-link-inline">
            {tr("View all", "عرض الكل")}
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
              <Link to={`/store/products?brand=${encodeURIComponent(brand)}`} className="store-brand-card">
                <span className="store-brand-logo">{brand}</span>
              </Link>
            </Motion.div>
          ))}
        </div>
      </section>

      <section className="store-home-metrics">
        <Motion.article initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <strong>{products.length}</strong>
          <span>{tr("Available Models", "الموديلات المتاحة")}</span>
        </Motion.article>
        <Motion.article initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.05 }}>
          <strong>{brands.length}</strong>
          <span>{tr("Popular Brands", "العلامات الشائعة")}</span>
        </Motion.article>
        <Motion.article initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>
          <strong>{offers.length}</strong>
          <span>{tr("Live Offers", "العروض الحالية")}</span>
        </Motion.article>
      </section>

      <section className="store-section">
        <div className="store-section-head">
          <h2>{content.featuredTitle || tr("Featured Laptops", "منتجات مميزة")}</h2>
          <Link to="/store/products">
            {tr("View all", "عرض الكل")}
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="store-home-featured-layout">
          {spotlight ? (
            <article className="store-spotlight-card">
              <StoreAdaptiveImage src={productImages(spotlight)[0]} alt={spotlight.laptopName} profile="card" />
              <div className="store-spotlight-content">
                <p className="store-eyebrow">{spotlight.brand}</p>
                <h3>{spotlight.laptopName}</h3>
                <p>
                  {spotlight.description || tr(
                    "Premium laptop ready for work, study, and gaming.",
                    "لابتوب احترافي جاهز للعمل والدراسة والألعاب.",
                  )}
                </p>
                <div className="store-hero-actions">
                  <Link to={`/store/products/${spotlight.id}`} className="store-primary-btn">
                    {tr("Open Details", "فتح التفاصيل")}
                  </Link>
                  <button type="button" className="store-secondary-btn" onClick={() => addToCart(spotlight.id)}>
                    {tr("Add To Cart", "أضف إلى السلة")}
                  </button>
                </div>
              </div>
            </article>
          ) : null}

          <div className="store-home-featured-list">
            {featuredList.map((product) => (
              <Link key={product.id} to={`/store/products/${product.id}`} className="store-featured-mini-card">
                <StoreAdaptiveImage src={productImages(product)[0]} alt={product.laptopName} profile="compact" />
                <div>
                  <strong>{product.laptopName}</strong>
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
          <h2>{content.offersTitle || tr("Best Offers", "أفضل العروض")}</h2>
          <p>
            {content.offersSubtitle || tr(
              "Hand-picked discounted devices with instant checkout.",
              "أجهزة مخفضة مختارة مع شراء سريع وآمن.",
            )}
          </p>
        </div>
        <div className="store-offer-strip">
          {offers.map((product) => (
            <article key={product.id} className="store-offer-card">
              <StoreAdaptiveImage src={productImages(product)[0]} alt={product.laptopName} profile="card" />
              <div>
                <p>{product.brand}</p>
                <h3>{product.laptopName}</h3>
                <span>{formatPrice(Number(product.discountedPrice || 0))}</span>
              </div>
              <div className="store-hero-actions">
                <Link to={`/store/products/${product.id}`} className="store-secondary-btn">
                  {tr("View", "عرض")}
                </Link>
                <button type="button" className="store-primary-btn" onClick={() => addToCart(product.id)}>
                  {tr("Add", "أضف")}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="store-faq">
        <div className="store-brands-head">
          <div>
            <p className="store-eyebrow">{tr("FAQ", "الأسئلة الشائعة")}</p>
            <h3>{content.faqTitle || tr("Frequently Asked Questions", "الأسئلة الشائعة")}</h3>
            <span>{content.faqSubtitle || tr("Answers for the most common customer questions.", "نحن هنا للإجابة على أكثر الأسئلة تكرارًا.")}</span>
          </div>
          <Link to="/store/support" className="store-link-inline">
            {tr("Need another answer? Talk to us now", "لم تجد إجابتك؟ تحدث معنا الآن")}
            <ArrowRight size={14} />
          </Link>
        </div>
        <div className="store-faq-grid">
          {faqItems.map((item, index) => (
            <Motion.article
              key={item.id}
              className="store-faq-card"
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.28, delay: index * 0.05 }}
            >
              <div className="store-faq-card-head">
                <span className="store-faq-icon">
                  <X size={18} />
                </span>
                <div className="store-faq-title-wrap">
                  <span>{item.id}</span>
                  <h4>{item.question}</h4>
                </div>
              </div>
              <p>{item.answer}</p>
              <Link to="/store/support" className="store-faq-link">
                {tr("Need another answer? Talk to us now", "لم تجد إجابتك؟ تحدث معنا الآن")}
              </Link>
            </Motion.article>
          ))}
        </div>
      </section>
    </div>
  );
}
'@ -split "`r?`n"

$lines = Replace-Lines -Source $lines -StartMarker 'function StoreHomePage() {' -EndMarker 'function StoreProductsPage() {' -Replacement $homeBlock

$detailsBlock = @'
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
      toast.error(tr("Please login first to submit a review.", "يرجى تسجيل الدخول أولًا لإضافة تقييم."));
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
      toast.success(tr("Your review has been saved.", "تم حفظ تقييمك بنجاح."));
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message || tr("Failed to submit review.", "تعذر إرسال التقييم."));
    } finally {
      setSubmittingReview(false);
    }
  }

  if (loadingDetail) {
    return (
      <section className="store-section">
        <p>{tr("Loading product details...", "جاري تحميل تفاصيل المنتج...")}</p>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="store-section">
        <p>{tr("Product not found.", "المنتج غير موجود.")}</p>
        <Link className="store-secondary-btn" to="/store/products">
          {tr("Back to Products", "الرجوع إلى المنتجات")}
        </Link>
      </section>
    );
  }

  const images = productImages(detail);
  const selected = images[Math.min(imageIndex, images.length - 1)];
  const reviews = Array.isArray(detail.reviews) ? detail.reviews : [];
  const maxQuantity = Math.max(1, Number(detail.stock || 1));
  const areReviewsEnabled = meta?.features?.reviewsEnabled !== false;
  const specGroups = [
    {
      title: tr("Core Specs", "المواصفات الأساسية"),
      items: [
        [tr("RAM", "الرام"), detail.ram],
        [tr("Storage", "التخزين"), detail.storage],
        ["CPU", detail.specs?.cpu],
        ["GPU", detail.specs?.gpu],
      ],
    },
    {
      title: tr("Display and Build", "الشاشة والتصميم"),
      items: [
        [tr("Display", "الشاشة"), detail.specs?.display],
        ["OS", detail.specs?.os],
        [tr("Weight", "الوزن"), detail.specs?.weight],
        [tr("Battery", "البطارية"), detail.specs?.battery],
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
            <StoreAdaptiveImage src={selected} alt={detail.laptopName} className="store-detail-main-image" profile="detail" />
            <div className="store-detail-zoom-hint">
              {isTouchDevice ? tr("Tap image to zoom", "اضغط على الصورة للتكبير") : tr("Hover image to zoom", "حرك الماوس على الصورة للتكبير")}
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
                <StoreAdaptiveImage src={image} alt={`${detail.laptopName} ${index + 1}`} profile="compact" />
              </button>
            ))}
          </div>
        </div>

        <div className="store-detail-info">
          <p className="store-eyebrow">{detail.brand}</p>
          <h1>{detail.laptopName}</h1>
          <p>{detail.description}</p>
          <div className="store-product-price">
            {detail.discountPercent > 0 ? (
              <>
                <span className="new">{formatPrice(Number(detail.discountedPrice || 0))}</span>
                <span className="old">{formatPrice(Number(detail.price || 0))}</span>
              </>
            ) : (
              <span className="new">{formatPrice(Number(detail.price || 0))}</span>
            )}
          </div>

          <div className="store-badges">
            <span>
              <BadgeCheck size={14} />
              {detail.stock > 0 ? tr(`Available (${detail.stock})`, `متاح (${detail.stock})`) : tr("Out of stock", "غير متوفر")}
            </span>
            <span>
              <Truck size={14} />
              {detail.shippingInfo}
            </span>
            <span>
              <BadgeCheck size={14} />
              {tr("Warranty", "الضمان")}: {detail.warrantyMonths} {tr("months", "شهر")}
            </span>
            {areReviewsEnabled ? (
              <span>
                <Star size={14} />
                {tr("Rating", "التقييم")}: {Number(detail.averageRating || 0).toFixed(1)} ({number.format(detail.reviewCount || 0)} {tr("reviews", "تقييم")})
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
            <button type="button" className="store-primary-btn store-add-cart-btn" disabled={detail.stock <= 0} onClick={() => addToCart(detail.id, quantity)}>
              <ShoppingBag size={18} />
              {tr("Add To Cart", "أضف للسلة")}
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
                <h4>{tr("Specifications", "المواصفات")}</h4>
                <p>{tr("Specifications will be added soon.", "سيتم إضافة المواصفات قريبًا.")}</p>
              </article>
            )}
          </div>

          {areReviewsEnabled ? (
            <section className="store-reviews">
              <h3>{tr("Customer Reviews", "تقييمات العملاء")}</h3>
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
                  placeholder={isCustomerAuthenticated ? tr("Write your review", "اكتب تقييمك") : tr("Login to add review", "سجل دخول لإضافة تقييم")}
                  disabled={!isCustomerAuthenticated}
                  required
                />
                <button type="submit" className="store-primary-btn" disabled={!isCustomerAuthenticated || submittingReview}>
                  {submittingReview ? tr("Submitting...", "جارٍ الإرسال...") : tr("Submit Review", "إرسال التقييم")}
                </button>
              </form>
              {isCustomerAuthenticated ? (
                <p className="review-hint">{tr("Signed in as", "تم تسجيل الدخول باسم")} {customerUser?.name}</p>
              ) : (
                <p className="review-hint">
                  {tr("Please", "من فضلك")} <Link to="/store/account">{tr("login", "تسجيل الدخول")}</Link> {tr("to rate this product.", "لتقييم هذا المنتج.")}
                </p>
              )}
              <div className="store-review-list">
                {reviews.length === 0 ? (
                  <p>{tr("No reviews yet.", "لا توجد تقييمات حتى الآن.")}</p>
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
          <h2>{tr("Related Products", "منتجات مشابهة")}</h2>
        </div>
        <div className="store-product-grid">
          {related.map((product) => (
            <ProductCard key={product.id} product={product} onAddToCart={addToCart} />
          ))}
        </div>
      </section>
    </div>
  );
}
'@ -split "`r?`n"

$lines = Replace-Lines -Source $lines -StartMarker 'function StoreProductDetailsPage() {' -EndMarker 'function StoreCartPage() {' -Replacement $detailsBlock

Set-Content -Path $filePath -Value $lines -Encoding utf8
