import { addLog } from "../services/logService.js";

function decodeHtml(html) {
  return html
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// Scrape Bing Images returning detailed metadata objects
async function scrapeBing(query) {
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&safeSearch=Active`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`Bing Image search HTTP error: ${response.status}`);
  }

  const html = await response.text();
  const decoded = decodeHtml(html);
  
  const results = [];
  
  // Try parsing full JSON metadata blocks first
  const jsonRegex = /m="({[^"]+?})"/g;
  let match;
  while ((match = jsonRegex.exec(html)) !== null) {
    try {
      const obj = JSON.parse(decodeHtml(match[1]));
      if (obj.murl) {
        results.push({
          murl: obj.murl,
          purl: obj.purl || "",
          t: obj.t || ""
        });
      }
    } catch (e) {
      // ignore
    }
  }

  // Fallback to simple murl matching if no JSON metadata found
  if (results.length === 0) {
    const fallbackRegex = /"murl"\s*:\s*"(https?:\/\/[^"]+?)"/gi;
    let fbMatch;
    while ((fbMatch = fallbackRegex.exec(decoded)) !== null) {
      const imgUrl = fbMatch[1];
      if (imgUrl && !imgUrl.includes("bing.net") && !imgUrl.includes("onclick")) {
        results.push({
          murl: imgUrl,
          purl: "",
          t: ""
        });
      }
    }
  }
  
  return results;
}

// Scrape Yahoo Images returning detailed metadata objects
async function scrapeYahoo(query) {
  const url = `https://images.search.yahoo.com/search/images?p=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo Image search HTTP error: ${response.status}`);
  }

  const html = await response.text();
  const decoded = decodeHtml(html);
  
  const results = [];
  const regex = /"iurl"\s*:\s*"(https?:\/\/[^"]+?)"/gi;
  let match;
  while ((match = regex.exec(decoded)) !== null) {
    const imgUrl = match[1];
    if (imgUrl && !imgUrl.includes("yimg.com")) {
      results.push({
        murl: imgUrl,
        purl: "",
        t: ""
      });
    }
  }
  return results;
}

export async function fetchProductImages(productName) {
  if (!productName || typeof productName !== "string" || productName.trim() === "") {
    return { thumbnail: "", gallery: [] };
  }

  let query = productName.trim();
  const cleaned = query.replace(/\b(unknown brand|unknown|غير معروف)\b/gi, "").trim().replace(/\s+/g, " ");
  if (cleaned.length > 0) {
    query = cleaned;
  }
  
  // Append white background search keywords to get official product images
  const searchQuery = `${query} official laptop white background`;
  console.log(`[Image Fetcher] Querying images for: "${searchQuery}"`);

  let urls = [];
  try {
    urls = await scrapeBing(searchQuery);
  } catch (error) {
    console.error("[Image Fetcher] Bing scraping failed:", error.message);
  }

  if (urls.length === 0) {
    try {
      console.log("[Image Fetcher] Falling back to Yahoo Images...");
      urls = await scrapeYahoo(searchQuery);
    } catch (error) {
      console.error("[Image Fetcher] Yahoo scraping failed:", error.message);
    }
  }

  const BLOCKED_DOMAINS = [
    // Local Egyptian retailers
    "alfathtechnology",
    "elbadrgroup",
    "sigma-computer",
    "egyptlaptop",
    "el-rashidy",
    "elrashidy",
    "compu-me",
    "compume",
    "barakacomputer",
    "redline",
    "eastasia",
    "ecc",
    "redlineeg",
    "elbadreg",
    "sigmapc",
    "egypt-laptop",
    "compplaza",
    "hardslap",
    "cairolaptops",
    "computek",
    "computeka",
    "egylaptops",
    "maximumhardware",
    "maximum-hardware",
    "elsafwa",
    "el-safwa",
    "lapmarket",
    "lap-market",

    // Marketplaces & Socials (known for hotlink blocks or personal listings with watermarks)
    "olx",
    "dubizzle",
    "haraj",
    "opensooq",
    "facebook",
    "fbcdn",
    "instagram",
    "pinterest",
    "jumia",
    "souq",
    "amazon",
    "sharafdg",
    "rayashop",
    "ebay",
    "aliexpress",
    "noon",
    "btech",
    
    // Generic copyright/watermark keywords
    "watermark",
    "logo",
    "text",
    "copyright",

    // Bangladesh resellers and watermarked sites
    "computerzone",
    "computer-zone",
    "zonecomputer",
    ".bd",
    ".com.bd",
    "bd-computer",
    "bdcomputer"
  ];

  // De-duplicate and filter out bad/watermarked URLs
  const uniqueUrls = [];
  const seenUrls = new Set();

  for (const item of urls) {
    const url = item.murl;
    if (!url || seenUrls.has(url)) continue;
    
    // Basic extensions filter
    if (!(/\.(jpg|jpeg|png|webp|gif|svg)/i.test(url) || url.startsWith("http"))) {
      continue;
    }

    const urlLower = url.toLowerCase();
    const purlLower = (item.purl || "").toLowerCase();
    const titleLower = (item.t || "").toLowerCase();

    // 1. Check against BLOCKED_DOMAINS (in image URL or source page URL)
    let blocked = false;
    for (const domain of BLOCKED_DOMAINS) {
      if (urlLower.includes(domain) || purlLower.includes(domain)) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    // 2. Filter by Arabic/English retail keywords in Title or Description (to prevent watermarked shop listings)
    const retailKeywords = [
      "سعر", "مواصفات", "شراء", "للبيع", "خصم", "محل", "معرض", "شركة", 
      "تقسيط", "ضمان", "استيراد", "عرض", "عروض", "جديد", "مستعمل",
      "price", "buy", "shop", "store", "sale", "used", "discount", "warranty"
    ];
    let hasRetailKeyword = false;
    for (const kw of retailKeywords) {
      if (titleLower.includes(kw)) {
        hasRetailKeyword = true;
        break;
      }
    }
    if (hasRetailKeyword) continue;

    // 3. Skip images with Arabic characters in url/title that are not manufacturer sites
    // (most manufacturers host on global CDNs with english filenames. Local shops use arabic characters in their URLs or page titles).
    // If the title contains Arabic, it's highly likely to be a local Egyptian computer shop.
    if (/[\u0600-\u06FF]/.test(titleLower) || /[\u0600-\u06FF]/.test(urlLower)) {
      continue;
    }

    seenUrls.add(url);
    uniqueUrls.push(url);
  }

  console.log(`[Image Fetcher] Found ${uniqueUrls.length} unique images for "${query}"`);

  if (uniqueUrls.length === 0) {
    // Default placeholder in case nothing was found
    return {
      thumbnail: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=500&auto=format&fit=crop",
      gallery: [],
    };
  }

  const thumbnail = uniqueUrls[0];
  const gallery = uniqueUrls.slice(1, 5); // next 4 images

  try {
    await addLog({
      action: "fetch_images",
      module: "agent",
      user: { id: "system", username: "ai_image_fetcher" },
      details: `Fetched images for ${query}: thumbnail=${thumbnail.slice(0, 60)}... and ${gallery.length} gallery images.`,
    });
  } catch (logError) {
    console.error("Failed to add fetch_images log:", logError.message);
  }

  return {
    thumbnail,
    gallery,
  };
}
