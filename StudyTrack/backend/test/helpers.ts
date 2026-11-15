import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/app.ts";
import type { Db } from "../src/db.ts";

/** Vrai Postgres en mémoire (PGlite), avec le schéma de production : pas besoin d'Internet ni de Supabase pour tester. */
export async function testDb(): Promise<Db> {
  const pg = new PGlite();
  await pg.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  return {
    query: (text, params) => pg.query(text, params),
    tx: (fn) => pg.transaction((t) => fn((text, params) => t.query(text, params))),
  };
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
