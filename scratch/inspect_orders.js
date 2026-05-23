const fs = require('fs');
const db = JSON.parse(fs.readFileSync('./server/src/data/db.json', 'utf8'));
console.log('Orders Count:', db.onlineOrders.length);
db.onlineOrders.forEach(o => {
  console.log(`Order: ${o.orderNumber}, Email: ${o.customerEmail}, Status: ${o.status}`);
});
console.log('Coupons:', db.coupons);
