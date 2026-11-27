import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { sessionCookie, startApi } from "../../../test/helpers.ts";

/* Paiement d'un cycle (contrat §3 Paiement, §4), écrit avant le code. Chaque test a sa propre inscription. */

let t: Awaited<ReturnType<typeof startApi>>;
let cookie = "";
let owner = "";

before(async () => {
  t = await startApi();
  const res = await t.api("/auth/register", {
    method: "POST", body: JSON.stringify({ name: "Maman", email: "maman@example.com", password: "un-long-mot-de-passe" }),
  });
  cookie = sessionCookie(res);
  owner = (await res.json()).user.id;
});
after(() => t.close());

let n = 0;
async function enrollment() {
  n++;
  const id = async (table: string) =>
    (await t.db.query(`insert into ${table} (owner_id, name) values ($1, $2) returning id`, [owner, `${table} ${n}`])).rows[0].id;
  return (await t.db.query(
    `insert into enrollments (owner_id, student_id, teacher_id, subject_id, cycle_size, price)
     values ($1, $2, $3, $4, 4, 6000) returning id`,
    [owner, await id("students"), await id("teachers"), await id("subjects")],
  )).rows[0].id as string;
}

const send = (method: string, path: string, body: unknown = {}) =>
  t.api(path, { method, headers: { Cookie: cookie }, body: method === "GET" ? undefined : JSON.stringify(body) });
let day = 0;
async function completed(enrollmentId: string) {
  const date = new Date(Date.UTC(2026, 8, 1 + day++, 15)).toISOString();
  return (await (await send("POST", "/lessons", { enrollmentId, date, status: "completed" })).json()).id as string;
}
async function cyclesOf(enrollmentId: string) {
  const all = await (await send("GET", "/payment-cycles")).json();
  return all.filter((c: { enrollmentId: string }) => c.enrollmentId === enrollmentId)
    .sort((a: { number: number }, b: { number: number }) => a.number - b.number);
}
/** Une inscription avec un cycle plein de 4 séances. */
async function fullCycle() {
  const e = await enrollment();
  const lessons = [];
  for (let i = 0; i < 4; i++) lessons.push(await completed(e));
  return { e, lessons, cycle: (await cyclesOf(e))[0] };
}
const markPaid = (id: string, body: unknown = {}) => send("PATCH", `/payment-cycles/${id}/mark-paid`, body);
const markUnpaid = (id: string) => send("PATCH", `/payment-cycles/${id}/mark-unpaid`);
const message = async (res: Response) => (await res.json()).message;

test("paiement au premier cours : mark-paid dès la 1re séance ; les suivantes entrent dans ce cycle payé", async () => {
  const e = await enrollment();
  const first = await completed(e);
  const [c] = await cyclesOf(e);
  const res = await markPaid(c.id);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, "paid");
  const others = [await completed(e), await completed(e), await completed(e)];
  const [paid, ...rest] = await cyclesOf(e);
  assert.deepEqual(paid.lessonIds, [first, ...others]);
  assert.equal(paid.status, "paid");
  assert.equal(rest.length, 0);
  // le cycle payé est plein : la 5e séance ouvre le cycle 2 (le paiement suivant)
  const fifth = await completed(e);
  const [, second] = await cyclesOf(e);
  assert.equal(second.number, 2);
  assert.equal(second.status, "unpaid");
  assert.deepEqual(second.lessonIds, [fifth]);
});

test("mark-paid sur un cycle sans aucune séance : 409, rien ne change", async () => {
  const e = await enrollment();
  const id = await completed(e);
  await send("PATCH", `/lessons/${id}`, { status: "cancelled" }); // le cycle reste, vide
  const [c] = await cyclesOf(e);
  assert.deepEqual(c.lessonIds, []);
  const res = await markPaid(c.id);
  assert.equal(res.status, 409);
  assert.equal(await message(res), "Ce cycle n'a encore aucun cours.");
  assert.equal((await cyclesOf(e))[0].status, "unpaid");
});

test("mark-paid sur un cycle plein : payé, date, trace « paid » ; ses séances sont verrouillées", async () => {
  const { e, lessons, cycle } = await fullCycle();
  const res = await markPaid(cycle.id);
  assert.equal(res.status, 200);
  const paid = await res.json();
  assert.equal(paid.status, "paid");
  assert.match(paid.paidAt, /^\d{4}-\d{2}-\d{2}T.*Z$/);
  assert.equal(paid.events.length, 1);
  assert.equal(paid.events[0].type, "paid");
  assert.deepEqual(paid.lessonIds, lessons);
  assert.equal((await send("PATCH", `/lessons/${lessons[0]}`, { notes: "x" })).status, 409);

  const next = await completed(e);
  const [, second] = await cyclesOf(e);
  assert.equal(second.number, 2);
  assert.deepEqual(second.lessonIds, [next]);
});

test("mark-paid avec une date choisie ; deux fois de suite : 409", async () => {
  const { cycle } = await fullCycle();
  const paid = await (await markPaid(cycle.id, { paidAt: "2026-10-05T08:00:00.000Z" })).json();
  assert.equal(paid.paidAt, "2026-10-05T08:00:00.000Z");
  const again = await markPaid(cycle.id);
  assert.equal(again.status, 409);
  assert.equal(await message(again), "Ce cycle est déjà marqué comme payé.");
});

test("mark-unpaid : redevient à payer, paidAt retiré, trace ajoutée, séances inchangées et de nouveau modifiables", async () => {
  const { lessons, cycle } = await fullCycle();
  await markPaid(cycle.id);
  const res = await markUnpaid(cycle.id);
  assert.equal(res.status, 200);
  const c = await res.json();
  assert.equal(c.status, "unpaid");
  assert.equal(c.paidAt, undefined);
  assert.deepEqual(c.events.map((ev: { type: string }) => ev.type), ["paid", "unpaid"]);
  assert.deepEqual(c.lessonIds, lessons);
  assert.equal((await send("PATCH", `/lessons/${lessons[0]}`, { notes: "corrigé" })).status, 200);
});

test("mark-unpaid sur un cycle non payé : 409", async () => {
  const { cycle } = await fullCycle();
  const res = await markUnpaid(cycle.id);
  assert.equal(res.status, 409);
  assert.equal(await message(res), "Ce cycle n'est pas marqué comme payé.");
});

test("payé, corrigé, payé : l'historique ne fait que grandir", async () => {
  const { cycle } = await fullCycle();
  await markPaid(cycle.id);
  await markUnpaid(cycle.id);
  const c = await (await markPaid(cycle.id)).json();
  assert.deepEqual(c.events.map((ev: { type: string }) => ev.type), ["paid", "unpaid", "paid"]);
});

test("cycle inconnu ou id mal formé : 404 ; date invalide : 400", async () => {
  assert.equal((await markPaid("00000000-0000-0000-0000-000000000000")).status, 404);
  assert.equal((await markUnpaid("pas-un-id")).status, 404);
  const { cycle } = await fullCycle();
  assert.equal((await markPaid(cycle.id, { paidAt: "hier" })).status, 400);
});
