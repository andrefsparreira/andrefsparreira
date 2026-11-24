import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { ensureRetainerCatalog, seedIfEmpty } from "./seed";
import { requireViewer } from "./viewer";

export type Query = <T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[],
) => Promise<T[]>;

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
let pool: pg.Pool | undefined;
let local: PGlite | undefined;
let starting: Promise<void> | undefined;

async function raw<T extends Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  if (databaseUrl !== "") {
    pool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
    const result = await pool.query(text, params);
    return result.rows as T[];
  }
  if (!local) throw new Error("Base local ainda não está pronta.");
  const result = await local.query<T>(text, params);
  return result.rows;
}

async function migrationFiles(): Promise<string[]> {
  const dir = path.join(process.cwd(), "migrations");
  return (await readdir(dir).catch(() => [] as string[])).filter((file) => file.endsWith(".sql")).sort();
}

async function applyPostgresMigrations(client: pg.Client) {
  await client.query("set lock_timeout = '60s'");
  await client.query("select pg_advisory_lock(7272741)");
  await client.query(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const done = new Set((await client.query("select name from schema_migrations")).rows.map((row) => String(row.name)));
  const dir = path.join(process.cwd(), "migrations");
  for (const file of (await migrationFiles()).filter((name) => !done.has(name))) {
    await client.query("begin");
    try {
      await client.query(await readFile(path.join(dir, file), "utf8"));
      await client.query("insert into schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
}

async function init() {
  if (databaseUrl === "") {
    const { PGlite: LocalDatabase } = await import("@electric-sql/pglite");
    const db = new LocalDatabase();
    const dir = path.join(process.cwd(), "migrations");
    for (const file of await migrationFiles()) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }
    local = db;
    await ensureRetainerCatalog(raw);
    await seedIfEmpty(raw);
    return;
  }

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED?.trim() || databaseUrl });
  await client.connect();
  const query = (async (text, params = []) => (await client.query(text, params)).rows) as Query;
  try {
    await applyPostgresMigrations(client);
    await client.query("begin");
    await ensureRetainerCatalog(query);
    await seedIfEmpty(query);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

export function ready(): Promise<void> {
  starting ??= init().catch((error: unknown) => {
    starting = undefined;
    throw error;
  });
  return starting;
}

async function assertViewer() {
  try {
    const viewer = await requireViewer();
    if (!viewer) throw new Error("Sessão em falta.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Sessão em falta.")) throw error;
    if (message.includes("request scope") || message.includes("outside a request")) return;
    throw error;
  }
}

export async function sql<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  await assertViewer();
  await ready();
  return raw<T>(text, params);
}

export async function withTransaction<T>(fn: (query: Query) => Promise<T>): Promise<T> {
  await assertViewer();
  await ready();
  if (databaseUrl !== "") {
    pool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
    const client = await pool.connect();
    const query = (async (text, params = []) => (await client.query(text, params)).rows) as Query;
    try {
      await client.query("begin");
      const result = await fn(query);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
  if (!local) throw new Error("Base local ainda não está pronta.");
  return local.transaction(async (tx) => {
    const query = (async (text, params = []) => (await tx.query(text, params)).rows) as Query;
    return fn(query);
  });
}
