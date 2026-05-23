const fs = require('fs');
const lines = fs.readFileSync('./client/src/store/StoreApp.jsx', 'utf8').split('\n');

const results = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('StoreAdaptiveImage')) {
    results.push(`Line ${i+1}: ${line.trim()}`);
  }
}
fs.writeFileSync('./inspect_results.txt', results.join('\n'), 'utf8');
console.log('Done, wrote results to inspect_results.txt');
