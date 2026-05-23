import { buildAgentProductDraft } from "./server/src/services/operationsAgentService.js";

function test() {
  const cases = [
    {
      input: {
        brand: "Dell",
        laptopName: "Dell Precision 5520-XEON E3-1505M",
        cpu: "XEON E3-1505M",
        ram: "16GB",
        storage: "512GB SSD"
      },
      expectedName: "Dell Precision 5520"
    },
    {
      input: {
        brand: "HP",
        laptopName: "HP ProBook 445 G8 RYZEN 5 5600U R5-5600U 8GB",
        cpu: "RYZEN 5 5600U",
        ram: "8GB",
        storage: "N/A"
      },
      expectedName: "HP ProBook 445 G8"
    },
    {
      input: {
        brand: "Dell",
        laptopName: "precision 5550-I9/G10/T2000 i9-10TH 16GB",
        cpu: "i9-10TH",
        ram: "16GB",
        storage: "256GB"
      },
      expectedName: "Dell Precision 5550"
    }
  ];

  for (const c of cases) {
    const draft = buildAgentProductDraft(c.input);
    console.log(`Input Model: "${c.input.laptopName}" -> Output Name: "${draft.laptopName}" (Expected: "${c.expectedName}")`);
  }
}

test();
