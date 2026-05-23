const fs = require('fs');
const content = fs.readFileSync('client/src/store/store.css', 'utf8');
const lines = content.split('\n');

console.log('Searching for product image styling in store.css...');
lines.forEach((line, idx) => {
  if (line.includes('img') || line.includes('product-card') || line.includes('aspect') || line.includes('object-fit')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
