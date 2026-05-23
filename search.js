const fs = require('fs');
const path = require('path');

const filePath = path.resolve('client/src/store/StoreApp.jsx');
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

const patterns = [
  /paymentMethod/i,
  /paymob/i,
  /placeOrder/i,
  /submitCheckout/i
];

lines.forEach((line, index) => {
  const matched = patterns.some(pattern => pattern.test(line));
  if (matched) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
