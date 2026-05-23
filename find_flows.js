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
  if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (line.includes('confirmPayment') || line.includes('placeOrder') || line.includes('/store/success') || line.includes('placed successfully') || line.includes('setStep("success")')) {
        console.log(`${path.relative(clientSrc, filePath)}:${i+1} - ${line.trim()}`);
      }
    });
  }
});
