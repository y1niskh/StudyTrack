import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { startApi } from "./helpers.ts";

let t: Awaited<ReturnType<typeof startApi>>;
before(async () => { t = await startApi(); });
after(() => t.close());

test("GET /api/health répond ok quand la base répond", async () => {
  const res = await t.api("/health");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test("adresse inconnue : 404 avec un message en français", async () => {
  const res = await t.api("/nexiste-pas");
  assert.equal(res.status, 404);
  assert.equal((await res.json()).message, "Cette adresse n'existe pas.");
});

test("JSON mal formé : 400 sans détail technique", async () => {
  const res = await t.api("/health", { method: "POST", body: "{pas du json" });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).message, "Les données envoyées sont invalides.");
});

test("le schéma refuse une séance effectuée hors cycle, ou un cycle payé sans date", async () => {
  const q = t.db.query;
  const [u] = (await q(`insert into users (name, email, password_hash) values ('Maman', 'm@x.dz', 'h') returning id`)).rows;
  const id = async (table: string, name: string) =>
    (await q(`insert into ${table} (owner_id, name) values ($1, $2) returning id`, [u.id, name])).rows[0].id;
  const [e] = (await q(
    `insert into enrollments (owner_id, student_id, teacher_id, subject_id, cycle_size) values ($1, $2, $3, $4, 4) returning id`,
    [u.id, await id("students", "Sara"), await id("teachers", "M. Arris"), await id("subjects", "Maths")],
  )).rows;

  await assert.rejects(q(`insert into lessons (owner_id, enrollment_id, date, status) values ($1, $2, now(), 'completed')`, [u.id, e.id]));
  await assert.rejects(q(`insert into payment_cycles (owner_id, enrollment_id, number, status) values ($1, $2, 1, 'paid')`, [u.id, e.id]));
  await assert.rejects(q(`insert into students (owner_id, name) values ($1, 'SARA')`, [u.id]), "nom en double, à la casse près");
});
