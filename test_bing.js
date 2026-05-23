import fs from "fs";

function decodeHtml(html) {
  return html
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function test() {
  const query = "Dell Latitude 5490 official laptop white background";
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&safeSearch=Active`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    },
  });
  const html = await response.text();
  
  // Find all m="..." content
  const regex = /m="({[^"]+?})"/g;
  let match;
  const items = [];
  while ((match = regex.exec(html)) !== null) {
    try {
      const obj = JSON.parse(decodeHtml(match[1]));
      items.push(obj);
    } catch (e) {
      // ignore
    }
  }
  console.log(`Parsed ${items.length} image metadata objects.`);
  if (items.length > 0) {
    console.log("First 3 items:", JSON.stringify(items.slice(0, 3), null, 2));
  }
}

test().catch(console.error);
