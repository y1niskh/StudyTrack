import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { sessionCookie, startApi } from "../../../test/helpers.ts";

let t: Awaited<ReturnType<typeof startApi>>;
let cookie = "";

before(async () => {
  t = await startApi();
  const res = await t.api("/auth/register", {
    method: "POST", body: JSON.stringify({ name: "Maman", email: "maman@example.com", password: "un-long-mot-de-passe" }),
  });
  cookie = sessionCookie(res);
});
after(() => t.close());

const send = (method: string, path: string, body: unknown = {}) =>
  t.api(path, { method, headers: { Cookie: cookie }, body: method === "GET" ? undefined : JSON.stringify(body) });
const slot = (extra: object = {}) =>
  send("POST", "/slots", { studentName: "Sara", subjectName: "Maths", teacherName: "M. Arris", weekday: 6, time: "12:00", cycleSize: 4, price: 6000, ...extra });
const enrollments = async () => (await send("GET", "/enrollments")).json();

test("POST /slots : crée l'élève, la matière, l'enseignant et l'inscription ; since = aujourd'hui", async () => {
  const res = await slot();
  assert.equal(res.status, 201);
  const s = await res.json();
  assert.equal(s.weekday, 6);
  assert.equal(s.time, "12:00");
  assert.match(s.since, /^\d{4}-\d{2}-\d{2}$/);
  const [e] = await enrollments();
  assert.equal(s.enrollmentId, e.id);
  assert.deepEqual([e.studentName, e.subjectName, e.teacherName, e.cycleSize, e.price], ["Sara", "Maths", "M. Arris", 4, 6000]);
});

test("mêmes noms, autre casse et espaces : même inscription ; cycleSize et price ignorés", async () => {
  const res = await slot({ studentName: "  SARA ", subjectName: "maths", teacherName: "m. arris", weekday: 3, cycleSize: 8, price: 9000 });
  assert.equal(res.status, 201);
  const list = await enrollments();
  assert.equal(list.length, 1);
  assert.equal(list[0].cycleSize, 4);
  assert.equal(list[0].price, 6000);
});

test("même inscription, même jour, même heure : 409", async () => {
  const res = await slot({ studentName: "sara" });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).message, "Ce cours existe déjà à ce jour et à cette heure.");
});

test("données invalides : 400", async () => {
  for (const bad of [{ weekday: 7 }, { time: "25:00" }, { studentName: "  " }, { cycleSize: 0 }]) {
    assert.equal((await slot(bad)).status, 400, JSON.stringify(bad));
  }
});

test("DELETE /slots : enlève les séances prévues à venir, garde le passé, les effectuées et les annulées", async () => {
  const s = await (await slot({ studentName: "Yacine", weekday: 1, time: "18:00" })).json();
  const lesson = async (date: string, status: string, occurrence: string) =>
    (await (await send("POST", "/lessons", { enrollmentId: s.enrollmentId, date, status, slotId: s.id, occurrence })).json()).id;
  const futurePlanned = await lesson("2099-01-05T17:00:00.000Z", "planned", "2099-01-05");
  const pastPlanned = await lesson("2020-01-06T17:00:00.000Z", "planned", "2020-01-06");
  const done = await lesson("2020-01-13T17:00:00.000Z", "completed", "2020-01-13");
  const cancelled = await lesson("2099-01-12T17:00:00.000Z", "cancelled", "2099-01-12");

  assert.equal((await send("DELETE", `/slots/${s.id}`)).status, 204);
  const left = (await (await send("GET", "/lessons")).json()).map((l: { id: string }) => l.id);
  assert.ok(!left.includes(futurePlanned));
  for (const kept of [pastPlanned, done, cancelled]) assert.ok(left.includes(kept));
  assert.ok(!(await (await send("GET", "/slots")).json()).some((x: { id: string }) => x.id === s.id));
  assert.equal((await send("DELETE", `/slots/${s.id}`)).status, 404);
});
