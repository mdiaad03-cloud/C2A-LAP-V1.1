const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, 'server/src/data/db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

const products = db.products || [];
console.log(`Total products: ${products.length}\n`);

products.forEach((p, i) => {
  const imgs = Array.isArray(p.imageUrls) ? p.imageUrls : [];
  const firstImg = imgs.length > 0 ? imgs[0].substring(0, 80) : 'NO IMAGES';
  console.log(`${i+1}. ${p.brand} ${p.laptopName}`);
  console.log(`   Price: ${p.price} | SellingPrice: ${p.sellingPrice} | PurchasePrice: ${p.purchasePrice}`);
  console.log(`   RAM: ${p.ram} | Storage: ${p.storage} | Stock: ${p.stock}`);
  console.log(`   Images (${imgs.length}): ${firstImg}`);
  console.log('');
});
