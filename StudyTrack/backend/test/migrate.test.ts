import assert from "node:assert/strict";
import { test } from "node:test";
import { migrate } from "../src/migrate.ts";
import { emptyDb } from "./helpers.ts";

test("les migrations s'appliquent une fois, puis plus rien la deuxième fois", async () => {
  const db = emptyDb();

  const first = await migrate(db);
  assert.ok(first.includes("001_init.sql"));

  assert.deepEqual(await migrate(db), []);

  const { rows } = await db.query("select count(*)::int as n from schema_migrations");
  assert.equal(rows[0].n, first.length);
  await db.query("select id from lessons limit 1"); // les tables existent
});

test("chaque table du schéma public a la sécurité par ligne (API REST de Supabase fermée)", async () => {
  const db = emptyDb();
  await migrate(db);
  const { rows } = await db.query(
    "select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity",
  );
  assert.deepEqual(rows.map((r) => r.relname), [], "tables sans RLS");
});
