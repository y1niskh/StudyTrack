import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { sessionCookie, startApi } from "../../../test/helpers.ts";
import { type Ids, seedOwner } from "../../../test/safety.ts";

let t: Awaited<ReturnType<typeof startApi>>;
let cookie = "";
let ids: Ids;
let paidCycleId = "";

before(async () => {
  t = await startApi();
  const res = await t.api("/auth/register", {
    method: "POST", body: JSON.stringify({ name: "Maman", email: "maman@example.com", password: "un-long-mot-de-passe" }),
  });
  cookie = sessionCookie(res);
  const owner = (await res.json()).user.id;
  ids = await seedOwner(t.db, owner); // cycle 1 non payé, avec une séance effectuée
  paidCycleId = (await t.db.query(
    `insert into payment_cycles (owner_id, enrollment_id, number, amount, status, paid_at)
     values ($1, $2, 2, 6000, 'paid', '2026-10-05T08:00:00Z') returning id`,
    [owner, ids.enrollmentId],
  )).rows[0].id;
});
after(() => t.close());

const get = async (path: string) => (await t.api(path, { headers: { Cookie: cookie } })).json();
const patch = (body: unknown) =>
  t.api(`/enrollments/${ids.enrollmentId}`, { method: "PATCH", body: JSON.stringify(body), headers: { Cookie: cookie } });

test("GET /enrollments : à plat, avec les noms", async () => {
  const [e] = await get("/enrollments");
  assert.equal(e.id, ids.enrollmentId);
  assert.equal(e.studentName, "Sara");
  assert.equal(e.teacherName, "M. Arris");
  assert.equal(e.subjectName, "Maths");
  assert.equal(e.cycleSize, 4);
  assert.equal(e.price, 6000);
  assert.equal(e._id, undefined);
});

test("GET /lessons : date ISO en UTC, occurrence locale AAAA-MM-JJ, pas de champ null", async () => {
  const [l] = await get("/lessons");
  assert.deepEqual(l, {
    id: ids.lessonId, enrollmentId: ids.enrollmentId, date: "2026-11-14T11:00:00.000Z",
    status: "completed", slotId: ids.slotId, occurrence: "2026-11-14",
  });
});

test("GET /payment-cycles : lessonIds rempli, payés et non payés", async () => {
  const cycles = await get("/payment-cycles");
  const unpaid = cycles.find((c: { id: string }) => c.id === ids.cycleId);
  const paid = cycles.find((c: { id: string }) => c.id === paidCycleId);
  assert.deepEqual(unpaid.lessonIds, [ids.lessonId]);
  assert.equal(unpaid.status, "unpaid");
  assert.equal(unpaid.paidAt, undefined);
  assert.deepEqual(paid.lessonIds, []);
  assert.equal(paid.paidAt, "2026-10-05T08:00:00.000Z");
  assert.deepEqual(paid.events, []);
});

test("GET /slots : jour, heure et date de début en texte", async () => {
  const [s] = await get("/slots");
  assert.equal(s.id, ids.slotId);
  assert.equal(s.weekday, 6);
  assert.equal(s.time, "12:00");
  assert.match(s.since, /^\d{4}-\d{2}-\d{2}$/);
});

test("PATCH price : les cycles non payés prennent le prix, les payés gardent le leur, aucune séance ne bouge", async () => {
  const res = await patch({ price: 7000 });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).price, 7000);
  const cycles = await get("/payment-cycles");
  assert.equal(cycles.find((c: { id: string }) => c.id === ids.cycleId).amount, 7000);
  assert.equal(cycles.find((c: { id: string }) => c.id === paidCycleId).amount, 6000);
  assert.deepEqual(cycles.find((c: { id: string }) => c.id === ids.cycleId).lessonIds, [ids.lessonId]);
});

test("PATCH price: null retire le prix ; cycleSize change seul", async () => {
  const removed = await (await patch({ price: null })).json();
  assert.equal(removed.price, undefined);
  const resized = await (await patch({ cycleSize: 8 })).json();
  assert.equal(resized.cycleSize, 8);
  assert.equal(resized.price, undefined, "le prix retiré reste retiré");
});

test("PATCH cycleSize 0, négatif ou décimal : 400 avec le message du contrat", async () => {
  for (const cycleSize of [0, -2, 4.5, "4"]) {
    const res = await patch({ cycleSize });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).message, "Le nombre de cours avant paiement doit être un nombre entier, par exemple 4.");
  }
  const price = await patch({ price: -1 });
  assert.equal(price.status, 400);
  assert.equal((await price.json()).message, "Le prix doit être un nombre, par exemple 6000.");
});

test("PATCH sur un id inconnu ou mal formé : 404", async () => {
  const unknown = await t.api("/enrollments/00000000-0000-0000-0000-000000000000",
    { method: "PATCH", body: "{}", headers: { Cookie: cookie } });
  assert.equal(unknown.status, 404);
  const garbage = await t.api("/enrollments/pas-un-id", { method: "PATCH", body: "{}", headers: { Cookie: cookie } });
  assert.equal(garbage.status, 404);
});
