import assert from "node:assert/strict";
import type { Db } from "../src/db.ts";

/* Le filet de sécurité (TRD §6, règle 1 de CLAUDE.md) : pour chaque route protégée,
   (1) sans cookie → 401 ; (2) un autre utilisateur (B) qui vise les données de A → le code attendu (404 par défaut),
   aucun identifiant de A dans la réponse, et les données de A inchangées. */

/** Les données de A créées par `seedOwner` : leurs ids remplacent `:enrollmentId`, `:lessonId`… dans les chemins. */
export interface Ids { enrollmentId: string; lessonId: string; cycleId: string; slotId: string }

export interface ProtectedRoute {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string; // relatif à /api, ex. "/lessons/:lessonId"
  body?: (ids: Ids) => unknown; // reçoit les ids de A : B essaie de s'en servir
  expect?: number; // statut attendu pour B : 404 par défaut ; 200/201/204 pour une liste ou une action sur ses propres données
}

const TABLES = ["students", "teachers", "subjects", "enrollments", "slots", "payment_cycles", "lessons"];

/** Crée pour `ownerId` un élève, un enseignant, une matière, une inscription, un créneau, un cycle et une séance effectuée. */
export async function seedOwner(db: Db, ownerId: string): Promise<Ids> {
  const one = async (sql: string, params: unknown[]) => (await db.query(sql, params)).rows[0].id as string;
  const named = (table: string, name: string) =>
    one(`insert into ${table} (owner_id, name) values ($1, $2) returning id`, [ownerId, name]);
  const enrollmentId = await one(
    `insert into enrollments (owner_id, student_id, teacher_id, subject_id, cycle_size, price)
     values ($1, $2, $3, $4, 4, 6000) returning id`,
    [ownerId, await named("students", "Sara"), await named("teachers", "M. Arris"), await named("subjects", "Maths")],
  );
  const slotId = await one(
    "insert into slots (owner_id, enrollment_id, weekday, time) values ($1, $2, 6, '12:00') returning id", [ownerId, enrollmentId],
  );
  const cycleId = await one(
    "insert into payment_cycles (owner_id, enrollment_id, number, amount) values ($1, $2, 1, 6000) returning id", [ownerId, enrollmentId],
  );
  const lessonId = await one(
    `insert into lessons (owner_id, enrollment_id, date, status, slot_id, occurrence, cycle_id)
     values ($1, $2, '2026-11-14T11:00:00Z', 'completed', $3, '2026-11-14', $4) returning id`,
    [ownerId, enrollmentId, slotId, cycleId],
  );
  return { enrollmentId, lessonId, cycleId, slotId };
}

/** Toutes les lignes de `ownerId`, pour vérifier qu'une requête de B n'a rien changé chez A. */
export async function snapshot(db: Db, ownerId: string) {
  const all: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    all[table] = (await db.query(`select to_jsonb(t) as row from ${table} t where owner_id = $1 order by id`, [ownerId])).rows;
  }
  return all;
}

type Send = (path: string, init: RequestInit) => Promise<Response>;

/** Les deux vérifications pour une route. `send` envoie à l'API ; les cookies sont ceux de B. */
export async function checkRoute(send: Send, db: Db, route: ProtectedRoute, a: { id: string; ids: Ids }, cookieB: string) {
  const path = route.path.replace(/:(\w+)/g, (_m, key: string) => a.ids[key as keyof Ids] ?? `:${key}`);
  const init = (cookie: string): RequestInit => ({
    method: route.method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: route.method === "GET" ? undefined : JSON.stringify(route.body?.(a.ids) ?? {}),
  });
  const label = `${route.method} ${route.path}`;

  const anonymous = await send(path, init(""));
  assert.equal(anonymous.status, 401, `${label} sans cookie doit répondre 401`);

  const before = await snapshot(db, a.id);
  const res = await send(path, init(cookieB));
  const text = await res.text();
  assert.equal(res.status, route.expect ?? 404, `${label} par un autre utilisateur : statut inattendu (${text})`);
  for (const id of Object.values(a.ids)) assert.ok(!text.includes(id), `${label} renvoie une donnée de l'autre utilisateur`);
  assert.deepEqual(await snapshot(db, a.id), before, `${label} a modifié les données de l'autre utilisateur`);
}
