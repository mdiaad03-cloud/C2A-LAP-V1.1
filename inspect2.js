const db = JSON.parse(require('fs').readFileSync('server/src/data/db.json', 'utf-8'));
const p = db.products[0];
console.log(JSON.stringify(p, null, 2));
console.log('\n--- storeSettings ---');
console.log(JSON.stringify(db.storeSettings?.agentSettings, null, 2));
