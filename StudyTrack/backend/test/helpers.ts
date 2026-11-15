import { PGlite, type Transaction } from "@electric-sql/pglite";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/app.ts";
import type { Db, Query } from "../src/db.ts";
import { migrate } from "../src/migrate.ts";

/** Comme pg : sans paramètres, le texte peut contenir plusieurs instructions (fichier de migration). */
const run = (pg: PGlite | Transaction): Query => async (text, params) =>
  params ? pg.query(text, params) : { rows: (await pg.exec(text)).at(-1)?.rows ?? [] };

/** Vrai Postgres en mémoire (PGlite), vide. */
export function emptyDb(): Db {
  const pg = new PGlite();
  return { query: run(pg), tx: (fn) => pg.transaction((t) => fn(run(t))) };
}

/** Base en mémoire construite avec les mêmes migrations que Supabase : pas besoin d'Internet pour tester. */
export async function testDb(): Promise<Db> {
  const db = emptyDb();
  await migrate(db);
  return db;
}

/** Démarre l'API sur un port libre. Renvoie une fonction `api(chemin, options)` et `close()`. */
export async function startApi(db?: Db) {
  const database = db ?? (await testDb());
  const server = createApp(database).listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://localhost:${(server.address() as AddressInfo).port}/api`;
  const api = (path: string, init: RequestInit = {}) =>
    fetch(base + path, { ...init, headers: { "Content-Type": "application/json", ...init.headers } });
  return { api, db: database, close: () => new Promise((r) => server.close(r)) };
}
