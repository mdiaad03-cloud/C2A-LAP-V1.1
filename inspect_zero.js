const fs = require('fs');
const path = require('path');

try {
  const dbPath = path.resolve('server/src/data/db.json');
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  
  const zeroProducts = db.products.filter(p => !p.price || p.price === 0 || !p.sellingPrice || p.sellingPrice === 0);
  
  const report = [];
  report.push(`Total products: ${db.products.length}`);
  report.push(`Zero-priced products: ${zeroProducts.length}`);
  report.push('\n--- Products Details & Matches ---');
  
  for (const prod of zeroProducts) {
    // Try to find in sales
    const matches = db.sales.filter(s => {
      const sName = String(s.laptopName || '').toLowerCase();
      const pName = String(prod.laptopName || '').toLowerCase();
      return sName.includes(pName) || pName.includes(sName);
    });
    
    // Try to find in online orders
    const orderMatches = [];
    if (db.onlineOrders) {
      for (const order of db.onlineOrders) {
        if (order.items) {
          for (const item of order.items) {
            const iName = String(item.laptopName || item.name || '').toLowerCase();
            const pName = String(prod.laptopName || '').toLowerCase();
            if (iName.includes(pName) || pName.includes(iName)) {
              orderMatches.push({ order, item });
            }
          }
        }
      }
    }
    
    report.push(`Product ID: ${prod.id}`);
    report.push(`SKU: ${prod.sku}`);
    report.push(`Name: ${prod.laptopName}`);
    report.push(`Specs: RAM ${prod.ram}, Storage ${prod.storage}`);
    
    if (matches.length > 0) {
      report.push(`  Matched Sales (${matches.length}):`);
      matches.forEach(m => {
        report.push(`    - Sale ID: ${m.id}, Date: ${m.purchaseDate}, PurchasePrice: ${m.purchasePrice}, SellingPrice: ${m.sellingPrice}`);
      });
    } else {
      report.push(`  No matched sales found.`);
    }
    
    if (orderMatches.length > 0) {
      report.push(`  Matched Online Orders (${orderMatches.length}):`);
      orderMatches.forEach(om => {
        report.push(`    - Order #: ${om.order.orderNumber}, Status: ${om.order.status}, Price in Order: ${om.item.price || om.item.sellingPrice}`);
      });
    } else {
      report.push(`  No matched online orders found.`);
    }
    report.push('----------------------------------\n');
  }
  
  fs.writeFileSync('inspect_zero_report.txt', report.join('\n'), 'utf8');
  console.log('Inspection report written to inspect_zero_report.txt');
} catch (e) {
  console.error('Error running inspection:', e);
}
