const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== 'node_modules' && f !== '.git' && f !== 'dist') {
        walkDir(dirPath, callback);
      }
    } else {
      callback(dirPath);
    }
  });
}

const rootDir = path.resolve(__dirname);
walkDir(rootDir, (filePath) => {
  if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      const lower = line.toLowerCase();
      if (lower.includes('required') && (lower.includes('throw') || lower.includes('error') || lower.includes('toast') || lower.includes('alert') || lower.includes('status('))) {
        console.log(`${path.relative(rootDir, filePath)}:${i+1} - ${line.trim()}`);
      }
    });
  }
});
