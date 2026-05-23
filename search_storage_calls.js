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
    if (content.includes('storage') || content.includes('Storage')) {
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (line.includes('requireText') || line.includes('validation') || line.includes('required') || line.includes('Storage')) {
          if (line.toLowerCase().includes('storage') || line.toLowerCase().includes('requiretext')) {
             console.log(`${path.relative(rootDir, filePath)}:${i+1} - ${line.trim()}`);
          }
        }
      });
    }
  }
});
