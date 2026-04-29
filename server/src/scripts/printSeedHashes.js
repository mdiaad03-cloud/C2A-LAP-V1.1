import bcrypt from "bcryptjs";

const credentials = [
  ["mdiaad03", "#Ds228281"],
  ["metwally", "Wasta"],
  ["Araby", "269206mo"],
];

for (const [username, password] of credentials) {
  const hash = await bcrypt.hash(password, 10);
  console.log(`${username}: ${hash}`);
}
