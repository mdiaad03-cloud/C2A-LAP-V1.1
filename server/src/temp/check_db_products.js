import fs from 'node:fs';
import path from 'node:path';

const dbPath = 'C:/Users/mdiaa/.gemini/antigravity/scratch/c2a-lap-fixed/server/src/data/db.json';

if (fs.existsSync(dbPath)) {
  const content = fs.readFileSync(dbPath, 'utf8');
  const db = JSON.parse(content);
  console.log('Total products in database:', db.products.length);
  const unknownProducts = db.products.filter(p => p.brand === 'Unknown' || p.sellingPrice === 0 || p.price === 0);
  console.log('Products with brand "Unknown" or price 0:', unknownProducts.length);
  for (const p of unknownProducts.slice(0, 10)) {
    console.log(`- ID: ${p.id}, SKU: ${p.sku}, Name: ${p.laptopName}, Brand: ${p.brand}, Price: ${p.sellingPrice}`);
  }
} else {
  console.log('db.json not found at', dbPath);
}
