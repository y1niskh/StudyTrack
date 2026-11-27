import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { sessionCookie, startApi } from "../../../test/helpers.ts";

/* Règles des cycles (contrat §4), écrites avant le code. Chaque test a sa propre inscription : aucun ne gêne les autres. */

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
/** Une nouvelle inscription (cycle de 4, 6000 DA), avec des noms uniques. */
async function enrollment(cycleSize = 4, student?: string) {
  n++;
  student ??= `Élève ${n}`;
  const id = async (table: string, name: string) => (await t.db.query(
    `insert into ${table} (owner_id, name) values ($1, $2) on conflict (owner_id, lower(name)) do update set name = excluded.name returning id`,
    [owner, name],
  )).rows[0].id;
  return (await t.db.query(
    `insert into enrollments (owner_id, student_id, teacher_id, subject_id, cycle_size, price)
     values ($1, $2, $3, $4, $5, 6000) returning id`,
    [owner, await id("students", student), await id("teachers", `Prof ${n}`), await id("subjects", `Matière ${n}`), cycleSize],
  )).rows[0].id as string;
}

const send = (method: string, path: string, body?: unknown) =>
  t.api(path, { method, headers: { Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
let day = 0;
const date = () => new Date(Date.UTC(2026, 8, 1 + day++, 15)).toISOString();
async function lesson(enrollmentId: string, status = "completed", extra: object = {}) {
  const res = await send("POST", "/lessons", { enrollmentId, date: date(), status, ...extra });
  assert.equal(res.status, 201, await res.clone().text());
  return (await res.json()).id as string;
}
async function cyclesOf(enrollmentId: string) {
  const all = await (await send("GET", "/payment-cycles")).json();
  return all.filter((c: { enrollmentId: string }) => c.enrollmentId === enrollmentId)
    .sort((a: { number: number }, b: { number: number }) => a.number - b.number);
}
const markPaid = (cycleId: string) =>
  t.db.query("update payment_cycles set status = 'paid', paid_at = now() where id = $1", [cycleId]);

test("cycle de 4 : 3 séances effectuées, pas encore plein ; la 4e le remplit", async () => {
  const e = await enrollment();
  for (let i = 0; i < 3; i++) await lesson(e);
  let [c] = await cyclesOf(e);
  assert.equal(c.lessonIds.length, 3);
  assert.equal(c.number, 1);
  assert.equal(c.amount, 6000);
  await lesson(e);
  [c] = await cyclesOf(e);
  assert.equal(c.lessonIds.length, 4);
  assert.equal(c.status, "unpaid");
});

test("séances prévues ou annulées : jamais dans un cycle", async () => {
  const e = await enrollment();
  await lesson(e, "planned");
  await lesson(e, "cancelled");
  assert.deepEqual(await cyclesOf(e), []);
});

test("après un paiement : la séance suivante ouvre le cycle 2 ; le cycle payé garde ses 4 séances", async () => {
  const e = await enrollment();
  for (let i = 0; i < 4; i++) await lesson(e);
  const [first] = await cyclesOf(e);
  await markPaid(first.id);
  const fifth = await lesson(e);
  const [paid, second] = await cyclesOf(e);
  assert.equal(paid.lessonIds.length, 4);
  assert.equal(paid.status, "paid");
  assert.deepEqual(second.lessonIds, [fifth]);
  assert.equal(second.number, 2);
});

test("cycle plein mais pas payé : la séance suivante va dans un nouveau cycle, jamais en débordement", async () => {
  const e = await enrollment();
  for (let i = 0; i < 5; i++) await lesson(e);
  const [c1, c2] = await cyclesOf(e);
  assert.equal(c1.lessonIds.length, 4);
  assert.equal(c2.lessonIds.length, 1);
});

test("effectuée puis annulée (cycle non payé) : elle sort du cycle, qui n'est plus plein", async () => {
  const e = await enrollment();
  const ids = [];
  for (let i = 0; i < 4; i++) ids.push(await lesson(e));
  const res = await send("PATCH", `/lessons/${ids[3]}`, { status: "cancelled" });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, "cancelled");
  const [c] = await cyclesOf(e);
  assert.equal(c.lessonIds.length, 3);
  assert.ok(!c.lessonIds.includes(ids[3]));
  // et repassée en effectuée : elle revient dans le premier cycle non plein
  await send("PATCH", `/lessons/${ids[3]}`, { status: "completed" });
  assert.equal((await cyclesOf(e))[0].lessonIds.length, 4);
});

test("prévue puis effectuée : elle entre dans un cycle", async () => {
  const e = await enrollment();
  const id = await lesson(e, "planned");
  await send("PATCH", `/lessons/${id}`, { status: "completed" });
  assert.deepEqual((await cyclesOf(e))[0].lessonIds, [id]);
});

test("séance d'un cycle payé : modifier ou supprimer → 409, rien ne change", async () => {
  const e = await enrollment();
  const ids = [];
  for (let i = 0; i < 4; i++) ids.push(await lesson(e));
  await markPaid((await cyclesOf(e))[0].id);
  const before = await (await send("GET", "/lessons")).json();

  for (const res of [
    await send("PATCH", `/lessons/${ids[0]}`, { status: "cancelled" }),
    await send("PATCH", `/lessons/${ids[0]}`, { notes: "changé" }),
    await send("DELETE", `/lessons/${ids[0]}`, {}),
  ]) {
    assert.equal(res.status, 409);
    assert.equal((await res.json()).message, "Ce cours fait partie d'un cycle déjà payé : il ne peut plus être modifié.");
  }
  assert.deepEqual(await (await send("GET", "/lessons")).json(), before);
});

test("ajout rétroactif : premier cycle non plein ; jamais un cycle payé déjà plein", async () => {
  const e = await enrollment();
  for (let i = 0; i < 4; i++) await lesson(e);
  await markPaid((await cyclesOf(e))[0].id);
  await lesson(e); // cycle 2 : 1 séance
  const old = await send("POST", "/lessons", { enrollmentId: e, date: "2026-01-05T15:00:00.000Z", status: "completed" });
  const oldId = (await old.json()).id;
  const [paid, second] = await cyclesOf(e);
  assert.ok(!paid.lessonIds.includes(oldId));
  assert.ok(second.lessonIds.includes(oldId));
});

test("payé au premier cours : les séances suivantes complètent ce cycle payé, puis la suivante ouvre le cycle 2", async () => {
  const e = await enrollment();
  await lesson(e);
  await markPaid((await cyclesOf(e))[0].id);
  for (let i = 0; i < 3; i++) await lesson(e);
  let [c1, c2] = await cyclesOf(e);
  assert.equal(c1.lessonIds.length, 4);
  assert.equal(c1.status, "paid");
  assert.equal(c2, undefined);
  await lesson(e);
  [c1, c2] = await cyclesOf(e);
  assert.equal(c2.number, 2);
  assert.equal(c2.lessonIds.length, 1);
});

test("un ancien cycle payé ne reçoit plus de séances, même si le nombre de cours augmente", async () => {
  const e = await enrollment();
  for (let i = 0; i < 4; i++) await lesson(e);
  await markPaid((await cyclesOf(e))[0].id);
  await lesson(e); // cycle 2
  await markPaid((await cyclesOf(e))[1].id);
  await t.db.query("update enrollments set cycle_size = 8 where id = $1", [e]);
  const next = await lesson(e);
  const [c1, c2] = await cyclesOf(e);
  assert.equal(c1.lessonIds.length, 4); // le cycle 1, payé et plus le dernier, ne bouge pas
  assert.ok(c2.lessonIds.includes(next)); // la séance va dans le dernier cycle (payé, pas plein)
});

test("deux inscriptions du même élève : chacune ses cycles", async () => {
  const a = await enrollment(4, "Yacine");
  const b = await enrollment(4, "Yacine");
  await lesson(a);
  await lesson(a);
  await lesson(b);
  assert.equal((await cyclesOf(a))[0].lessonIds.length, 2);
  assert.equal((await cyclesOf(b))[0].lessonIds.length, 1);
});

test("supprimer une séance d'un cycle non payé : elle en sort ; 204", async () => {
  const e = await enrollment();
  const id = await lesson(e);
  const res = await send("DELETE", `/lessons/${id}`, {});
  assert.equal(res.status, 204);
  assert.deepEqual((await cyclesOf(e))[0].lessonIds, []);
});

test("cours qui se répète : la même date prévue deux fois → 409", async () => {
  const e = await enrollment();
  const slot = (await t.db.query(
    "insert into slots (owner_id, enrollment_id, weekday, time) values ($1, $2, 6, '12:00') returning id", [owner, e],
  )).rows[0].id;
  await lesson(e, "completed", { slotId: slot, occurrence: "2026-11-14" });
  const again = await send("POST", "/lessons", { enrollmentId: e, date: date(), status: "cancelled", slotId: slot, occurrence: "2026-11-14" });
  assert.equal(again.status, 409);
  assert.equal((await again.json()).message, "Ce cours est déjà enregistré.");
  const list = await (await send("GET", "/lessons")).json();
  assert.equal(list.filter((l: { slotId?: string }) => l.slotId === slot)[0].occurrence, "2026-11-14");
});

test("données invalides : 400 ; inscription inconnue : 404", async () => {
  const e = await enrollment();
  assert.equal((await send("POST", "/lessons", { enrollmentId: e, date: "demain", status: "completed" })).status, 400);
  assert.equal((await send("POST", "/lessons", { enrollmentId: e, date: date(), status: "fini" })).status, 400);
  assert.equal((await send("POST", "/lessons", { enrollmentId: e, date: date(), status: "planned", notes: "x".repeat(1001) })).status, 400);
  const unknown = await send("POST", "/lessons", { enrollmentId: "00000000-0000-0000-0000-000000000000", date: date(), status: "planned" });
  assert.equal(unknown.status, 404);
  assert.equal((await send("PATCH", "/lessons/pas-un-id", { notes: "x" })).status, 404);
});

test("PATCH ne change jamais l'inscription d'une séance ; notes vides → retirées", async () => {
  const e = await enrollment();
  const other = await enrollment();
  const id = await lesson(e, "planned", { notes: "Chapitre 3" });
  const res = await (await send("PATCH", `/lessons/${id}`, { enrollmentId: other, notes: "" })).json();
  assert.equal(res.enrollmentId, e);
  assert.equal(res.notes, undefined);
});
