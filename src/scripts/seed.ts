import { getDb, resetDatabase } from "../lib/db";

if (process.argv.includes("--reset")) {
  resetDatabase();
  console.log("Base reposta com o cliente de exemplo.");
} else {
  getDb();
  console.log("Base pronta. Se já existiam clientes, os dados foram mantidos.");
}
