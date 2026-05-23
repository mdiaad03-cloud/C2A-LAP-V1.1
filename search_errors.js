const fs = require('fs');
const path = require('path');

const distPath = path.resolve(__dirname, 'client/dist');
if (fs.existsSync(distPath)) {
  console.log("=== client/dist files ===");
  fs.readdirSync(distPath).forEach(file => {
    const filePath = path.join(distPath, file);
    const stats = fs.statSync(filePath);
    console.log(`${file} - Modified: ${stats.mtime}`);
  });
} else {
  console.log("client/dist does not exist!");
}
