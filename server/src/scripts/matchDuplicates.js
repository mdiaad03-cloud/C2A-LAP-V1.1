import fs from "node:fs/promises";
import path from "node:path";

function cleanName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function matchDuplicates() {
  const dbPath = path.resolve("src/data/db.json");
  try {
    const dataRaw = await fs.readFile(dbPath, "utf8");
    const db = JSON.parse(dataRaw);
    
    const zeroPriceProducts = db.products.filter(p => Number(p.sellingPrice) === 0);
    const validProducts = db.products.filter(p => Number(p.sellingPrice) > 0);
    
    console.log(`Found ${zeroPriceProducts.length} zero-price products and ${validProducts.length} valid products.`);
    
    zeroPriceProducts.forEach(zp => {
      const zpCleaned = cleanName(zp.laptopName);
      
      // Look for a match in valid products
      const match = validProducts.find(vp => {
        const vpCleaned = cleanName(vp.laptopName);
        return vpCleaned.includes(zpCleaned) || zpCleaned.includes(vpCleaned);
      });
      
      if (match) {
        console.log(`Match found:`);
        console.log(`  Zero-price: [ID: ${zp.id}] [Stock: ${zp.stock}] ${zp.laptopName}`);
        console.log(`  Valid-price: [ID: ${match.id}] [Stock: ${match.stock}] [Price: ${match.sellingPrice}] ${match.laptopName}`);
      } else {
        console.log(`No match for: [ID: ${zp.id}] [Stock: ${zp.stock}] ${zp.laptopName}`);
      }
    });

  } catch (err) {
    console.error(err);
  }
}

matchDuplicates();
