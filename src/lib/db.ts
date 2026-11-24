import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { seedIfEmpty } from "./seed";

const globalForDb = globalThis as unknown as { ksDb?: Database.Database };

export function databasePath(): string {
  return process.env.DATABASE_PATH || path.join(process.cwd(), "data", "ks.sqlite");
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      nif TEXT NOT NULL DEFAULT '',
      legal_form TEXT NOT NULL DEFAULT '',
      object TEXT NOT NULL DEFAULT '',
      irc_regime TEXT NOT NULL DEFAULT '',
      iva_regime TEXT NOT NULL DEFAULT '',
      capital REAL,
      partners TEXT NOT NULL DEFAULT '',
      bank_accounts INTEGER,
      expected_turnover REAL,
      employees_ex_manager INTEGER NOT NULL DEFAULT 0,
      situation_date TEXT,
      notes TEXT NOT NULL DEFAULT '',
      logo_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS service_types (
      code TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      default_periodicity TEXT NOT NULL,
      pricing_rule TEXT NOT NULL,
      default_inclusion TEXT NOT NULL,
      default_optional INTEGER NOT NULL DEFAULT 0,
      default_unit_value REAL,
      sort_order INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS fee_years (
      id INTEGER PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      UNIQUE(client_id, year)
    );

    CREATE TABLE IF NOT EXISTS fee_lines (
      id INTEGER PRIMARY KEY,
      year_id INTEGER NOT NULL REFERENCES fee_years(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL,
      type_code TEXT NOT NULL,
      description TEXT NOT NULL,
      periodicity TEXT NOT NULL,
      quantity REAL,
      inclusion TEXT NOT NULL,
      optional INTEGER NOT NULL DEFAULT 0,
      unit_value REAL,
      manual INTEGER NOT NULL DEFAULT 0,
      pricing_rule TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS proposals (
      id INTEGER PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      year INTEGER NOT NULL,
      proposal_date TEXT NOT NULL,
      title TEXT NOT NULL,
      sections_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(client_id, year)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

export function getDb(): Database.Database {
  if (globalForDb.ksDb) return globalForDb.ksDb;
  const file = databasePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  seedIfEmpty(db);
  globalForDb.ksDb = db;
  return db;
}

export function resetDatabase() {
  if (globalForDb.ksDb) {
    globalForDb.ksDb.close();
    globalForDb.ksDb = undefined;
  }
  const file = databasePath();
  for (const suffix of ["", "-wal", "-shm"]) {
    const target = file + suffix;
    if (fs.existsSync(target)) fs.unlinkSync(target);
  }
  getDb();
}
