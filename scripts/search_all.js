const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.gemini', 'exports', 'uploads', 'temp'];

function walk(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (ignoreDirs.includes(file)) continue;
    const filepath = path.join(dir, file);
    const stat = fs.statSync(filepath);
    if (stat.isDirectory()) {
      walk(filepath, callback);
    } else {
      callback(filepath);
    }
  }
}

const terms = [/stripe/i, /vodafone/i];
walk(projectRoot, (filepath) => {
  if (filepath.endsWith('.js') || filepath.endsWith('.jsx') || filepath.endsWith('.html') || filepath.endsWith('.css')) {
    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      terms.forEach((term) => {
        if (term.test(line)) {
          console.log(`${path.relative(projectRoot, filepath)}:${idx + 1}: ${line.trim()}`);
        }
      });
    });
  }
});
