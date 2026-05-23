const fs = require('fs');
const path = require('path');

const storeAppPath = path.resolve(__dirname, 'client/src/store/StoreApp.jsx');
const content = fs.readFileSync(storeAppPath, 'utf-8');
const lines = content.split('\n');

lines.forEach((line, i) => {
  if (line.includes('store-header') || line.includes('store-nav') || line.includes('Login') || line.includes('store-admin-link')) {
    console.log(`${i+1}: ${line.trim()}`);
  }
});
