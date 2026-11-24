import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { ensureRetainerCatalog, seedIfEmpty } from "./seed";

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

async function init() {
  if (databaseUrl === "") {
    const db = new PGlite();
    const dir = path.join(process.cwd(), "migrations");
    const files = (await readdir(dir).catch(() => [] as string[])).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      await db.exec(await readFile(path.join(dir, file), "utf8"));
    }
    local = db;
  }
  await ensureRetainerCatalog(raw);
  await seedIfEmpty(raw);
}

export function ready(): Promise<void> {
  starting ??= init();
  return starting;
}

export async function sql<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  await ready();
  return raw<T>(text, params);
}

export async function withTransaction<T>(fn: (query: Query) => Promise<T>): Promise<T> {
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
