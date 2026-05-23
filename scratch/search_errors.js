const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file.endsWith('.js')) {
      results.push(fullPath);
    }
  });
  return results;
}

const jsFiles = walk('server/src');
console.log('Searching for FIELD_ALIASES definitions...');
jsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('FIELD_ALIASES')) {
    console.log(`Found FIELD_ALIASES in: ${file}`);
  }
});
