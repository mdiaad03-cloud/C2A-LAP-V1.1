const fs = require('fs');
const path = require('path');

const dbPath = path.resolve('server/src/data/db.json');

const priceUpdates = {
  'gGuoDKNxWmSeeJe785j2u': { purchasePrice: 11500, sellingPrice: 14600 },
  'B_asg4aWMCHYCXAIrQz6j': { purchasePrice: 15500, sellingPrice: 18600 },
  'R2oOkfUfsELV0EJ5DVVJN': { purchasePrice: 7000, sellingPrice: 10100 },
  'wXsqc0irbudUUCtRNls1t': { purchasePrice: 8000, sellingPrice: 10500 },
  'fgsrgMKiIxeBisWlkax9Z': { purchasePrice: 12500, sellingPrice: 15600 },
  '4cs_ldnOl1pLadq7vmQSb': { purchasePrice: 7500, sellingPrice: 10000 },
  'jM_WWmeqqE2zMHhokyWSW': { purchasePrice: 28000, sellingPrice: 32000 },
  'DGmN7Azpp3Vo3NPBmHJTk': { purchasePrice: 11000, sellingPrice: 13500 },
  'HA-4gG16D9VTuyTlPKJaE': { purchasePrice: 12000, sellingPrice: 14500 },
  'Ghxi1pPycAUh9BtgGItV0': { purchasePrice: 13000, sellingPrice: 16000 },
  '_8w5xcu7j01iWrivQMpJC': { purchasePrice: 12000, sellingPrice: 15100 },
  'd3tb2SGZLhBKrlSNYKe9v': { purchasePrice: 11000, sellingPrice: 14000 },
  'atWDQcO7iY7on5Ox7JACa': { purchasePrice: 15500, sellingPrice: 18600 },
  'oRu6XEyPR_SBN2oPJsHYP': { purchasePrice: 30000, sellingPrice: 35000 },
  'kF_iBGlh4rxNqeLFK4sDn': { purchasePrice: 14500, sellingPrice: 17600 },
  'UjY2936xnaQChkyfIIYAe': { purchasePrice: 26000, sellingPrice: 29100 },
  'K_Up6eXcQuFx8FfhAVBb4': { purchasePrice: 28000, sellingPrice: 32000 },
  '0nmZyFKxP5iP1iYJZBlmm': { purchasePrice: 11000, sellingPrice: 14000 },
  'BGkAxwBrhpbC22Zo8-xBS': { purchasePrice: 26000, sellingPrice: 29100 },
  'KCmg5L_oh_w5DZLerl91y': { purchasePrice: 22500, sellingPrice: 25600 }
};

try {
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  
  let updatedCount = 0;
  db.products = db.products.map(p => {
    if (priceUpdates[p.id]) {
      const update = priceUpdates[p.id];
      updatedCount++;
      return {
        ...p,
        purchasePrice: update.purchasePrice,
        sellingPrice: update.sellingPrice,
        price: update.sellingPrice,
        updatedAt: new Date().toISOString()
      };
    }
    return p;
  });
  
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  console.log(`Successfully updated ${updatedCount} products in the database!`);
} catch (e) {
  console.error('Error fixing prices:', e);
}
