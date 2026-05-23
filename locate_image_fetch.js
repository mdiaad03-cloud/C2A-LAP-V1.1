const fs = require('fs');
const path = require('path');

const agentRoutesPath = path.resolve(__dirname, 'server/src/routes/agentRoutes.js');
const content = fs.readFileSync(agentRoutesPath, 'utf-8');
const lines = content.split('\n');

lines.forEach((line, i) => {
  if (line.includes('fetchProductImages')) {
    console.log(`${i+1}: ${line.trim()}`);
  }
});
