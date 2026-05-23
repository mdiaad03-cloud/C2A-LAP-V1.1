import fs from "node:fs/promises";
import path from "node:path";

async function printDescriptions() {
  const dbPath = path.resolve("src/data/db.json");
  try {
    const dataRaw = await fs.readFile(dbPath, "utf8");
    const db = JSON.parse(dataRaw);
    
    const unmatched = [
      "HyGCZCF7NQL47XF-Qapzc", // HP 845 G8 RYZEN 5 PRO - already resolved to 14600/11500
      "K-vWW1Vr5pXJXsDg3uEJh", // dell 3520 i5-7
      "cGPWvnQ34Qo4JxZ6Dt-Ck", // DELL Precision 5560
      "mP8SCCLxG8LZBYSpGObev", // elitebook 830 G7 I5
      "uVdIXSeWaVHP3NIhppcDe", // HP 850 G7 I5-10310U
      "_VeuVwT8fDzJFrQQ3eJO0", // Precision 5560
      "m9glH92nURDxGya_ScXQ4", // Precision 5540 - already resolved to 25600/22500
      "QctIuafEriZvZ5Hff7kda"  // HP ZBOOK STUDIO G8
    ];
    
    db.products.forEach(p => {
      if (unmatched.includes(p.id)) {
        console.log(`\nID: ${p.id}`);
        console.log(`Name: ${p.laptopName}`);
        console.log(`Desc: ${p.description}`);
      }
    });

  } catch (err) {
    console.error(err);
  }
}

printDescriptions();
