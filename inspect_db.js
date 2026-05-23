const fs = require('fs');
try {
  const db = JSON.parse(fs.readFileSync('./server/src/data/db.json', 'utf8'));
  const targetId = 'gGuoDKNxWmSeeJe785j2u';
  const product = db.products.find(p => p.id === targetId || p._id === targetId);
  const logContent = 'Target Product:\n' + JSON.stringify(product, null, 2) + '\n\n' +
                     'All Products:\n' + JSON.stringify(db.products.map(p => ({ id: p.id, brand: p.brand, laptopName: p.laptopName, price: p.price, sellingPrice: p.sellingPrice, purchasePrice: p.purchasePrice, imageUrls: p.imageUrls })), null, 2);
  fs.writeFileSync('./output.txt', logContent, 'utf8');
  console.log('Inspection success!');
} catch (e) {
  fs.writeFileSync('./output.txt', 'Error: ' + e.message, 'utf8');
  console.error('Inspection error:', e.message);
}
