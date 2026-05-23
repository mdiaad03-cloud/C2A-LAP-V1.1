import fs from "node:fs/promises";
import path from "node:path";

async function checkOrderPrices() {
  const dbPath = path.resolve("src/data/db.json");
  try {
    const dataRaw = await fs.readFile(dbPath, "utf8");
    const db = JSON.parse(dataRaw);
    
    const unknownProducts = db.products.filter(p => p.brand === "Unknown" || Number(p.sellingPrice) === 0);
    
    console.log("Analyzing prices in orders for unknown products:");
    
    unknownProducts.forEach(prod => {
      const refs = [];
      (db.onlineOrders || []).forEach(order => {
        (order.items || []).forEach(item => {
          if (item.productId === prod.id) {
            refs.push({ orderNumber: order.orderNumber, itemPrice: item.price, itemQuantity: item.quantity });
          }
        });
      });
      
      if (refs.length > 0) {
        console.log(`\nProduct: ${prod.laptopName} (ID: ${prod.id})`);
        refs.forEach(r => {
          console.log(` - Order #${r.orderNumber}: Price paid = ${r.itemPrice}, Qty = ${r.itemQuantity}`);
        });
      } else {
        console.log(`\nProduct: ${prod.laptopName} (ID: ${prod.id}) - No orders found`);
      }
    });

  } catch (err) {
    console.error(err);
  }
}

checkOrderPrices();
