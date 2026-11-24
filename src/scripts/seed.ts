import { sql, withTransaction } from "../lib/db";
import { seedIfEmpty } from "../lib/seed";

async function main() {
  if (process.argv.includes("--reset")) {
    await withTransaction(async (query) => {
      await query("DELETE FROM clients");
      await query("DELETE FROM service_types");
      await query("DELETE FROM settings");
      await seedIfEmpty(query);
    });
    console.log("Base reposta com o cliente de exemplo.");
    return;
  }
  await sql("SELECT 1");
  console.log("Base pronta. Se já existiam clientes, os dados foram mantidos.");
}

main();
