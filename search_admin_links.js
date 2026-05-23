const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

const clientSrc = path.resolve(__dirname, 'client/src');
walkDir(clientSrc, (filePath) => {
  if (filePath.endsWith('.js') || filePath.endsWith('.jsx') || filePath.endsWith('.css')) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      const lower = line.toLowerCase();
      if (lower.includes('admin') || line.includes('الادمن') || line.includes('الآدمن') || line.includes('الادمن')) {
        console.log(`${path.relative(clientSrc, filePath)}:${i+1} - ${line.trim()}`);
      }
    });
  }
});
