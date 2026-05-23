import { fetchProductImages } from "./server/src/utils/imageFetcher.js";

async function test() {
  console.log("Testing fetchProductImages for Dell Latitude 5490...");
  const res = await fetchProductImages("Dell Latitude 5490");
  console.log("Result:", JSON.stringify(res, null, 2));
}

test().catch(console.error);
