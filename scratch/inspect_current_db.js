const fs = require('fs');
const db = JSON.parse(fs.readFileSync('server/src/data/db.json', 'utf8'));

console.log('List of products in DB:');
db.products.forEach(p => {
  console.log(`Name: "${p.laptopName}", SKU: "${p.sku}", RAM: "${p.ram}", Storage: "${p.storage}"`);
});
