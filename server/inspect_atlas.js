import fs from 'node:fs';
import path from 'node:path';
import { MongoClient } from 'mongodb';

// Parse .env file manually
const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    env[key] = value.trim();
  }
});

const uri = env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI not found in .env");
  process.exit(1);
}

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('c2a_lap');
    const collection = db.collection('app_state');
    const doc = await collection.findOne({ _id: 'main_db' });
    if (!doc || !doc.data) {
      console.log("No database document found in Atlas.");
      return;
    }
    
    const dbData = doc.data;
    console.log("=== Database Overview ===");
    console.log("Last updated at:", dbData.meta?.updatedAt);
    console.log("Total users:", dbData.users?.length);
    console.log("Total onlineOrders:", dbData.onlineOrders?.length);
    
    console.log("\n=== Coupons ===");
    console.log(JSON.stringify(dbData.coupons, null, 2));
    
    console.log("\n=== Latest 10 Diagnostics ===");
    const diagnostics = (dbData.whatsappLogs || [])
      .filter(l => l.rawPhone === 'SYSTEM_DIAGNOSTIC')
      .slice(0, 10);
    console.log(JSON.stringify(diagnostics, null, 2));
    
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
  } finally {
    await client.close();
  }
}

main();
