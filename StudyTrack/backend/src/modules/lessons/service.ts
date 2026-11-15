import { compact, type Db, type Query } from "../../db.ts";
import { HttpError } from "../../errors.ts";
import { cycleFor } from "../cycles/service.ts";
import type { LessonCreate, LessonPatch } from "./schema.ts";

export const NOT_FOUND = "Ce cours n'existe plus.";
const LOCKED = "Ce cours fait partie d'un cycle déjà payé : il ne peut plus être modifié.";

// `occurrence` est une date locale : rendue en texte "AAAA-MM-JJ", jamais via un Date JavaScript (décalage).
const SELECT = `select id, enrollment_id as "enrollmentId", date, status, notes, slot_id as "slotId",
                       to_char(occurrence, 'YYYY-MM-DD') as occurrence
                from lessons`;

export async function listLessons(db: Db, ownerId: string) {
  return (await db.query(`${SELECT} where owner_id = $1 order by date`, [ownerId])).rows.map(compact);
}

const getLesson = async (q: Query, id: string) => compact((await q(`${SELECT} where id = $1`, [id])).rows[0]);

/** Verrouille l'inscription de la séance (règle 4) puis renvoie la séance et l'état de son cycle. 404 si pas à lui. */
async function lockLesson(q: Query, ownerId: string, id: string) {
  await q(
    `select e.id from enrollments e join lessons l on l.enrollment_id = e.id
     where l.id = $1 and l.owner_id = $2 for update of e`,
    [id, ownerId],
  );
  const row = (await q(
    `select l.*, c.status as cycle_status from lessons l left join payment_cycles c on c.id = l.cycle_id
     where l.id = $1 and l.owner_id = $2`,
    [id, ownerId],
  )).rows[0];
  if (!row) throw new HttpError(404, NOT_FOUND);
  if (row.cycle_status === "paid") throw new HttpError(409, LOCKED); // règle 6
  return row;
}

export async function createLesson(db: Db, ownerId: string, input: LessonCreate) {
  return db.tx(async (q) => {
    const locked = await q("select id from enrollments where id = $1 and owner_id = $2 for update", [input.enrollmentId, ownerId]);
    if (!locked.rows[0]) throw new HttpError(404, "Ce cours suivi n'existe pas.");
    if (input.slotId) {
      const slot = await q("select id from slots where id = $1 and enrollment_id = $2", [input.slotId, input.enrollmentId]);
      if (!slot.rows[0]) throw new HttpError(404, "Ce cours qui se répète n'existe plus.");
      const dup = await q("select id from lessons where slot_id = $1 and occurrence = $2", [input.slotId, input.occurrence]);
      if (dup.rows[0]) throw new HttpError(409, "Ce cours est déjà enregistré.");
    }
    // Règle 1 : une séance effectuée entre dans un cycle, dans la même instruction (la base l'exige).
    const cycleId = input.status === "completed" ? await cycleFor(q, ownerId, input.enrollmentId) : null;
    const { rows } = await q(
      `insert into lessons (owner_id, enrollment_id, date, status, notes, slot_id, occurrence, cycle_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
      [ownerId, input.enrollmentId, input.date, input.status, input.notes || null, input.slotId ?? null, input.occurrence ?? null, cycleId],
    );
    return getLesson(q, rows[0].id);
  });
}

export async function updateLesson(db: Db, ownerId: string, id: string, patch: LessonPatch) {
  return db.tx(async (q) => {
    const row = await lockLesson(q, ownerId, id);
    const status = patch.status ?? row.status;
    // Règles 2 et 3 : devient effectuée → entre dans un cycle ; ne l'est plus → en sort ; sinon ne bouge pas.
    let cycleId = row.cycle_id;
    if (status === "completed" && row.status !== "completed") cycleId = await cycleFor(q, ownerId, row.enrollment_id);
    if (status !== "completed") cycleId = null;
    const notes = patch.notes === undefined ? row.notes : patch.notes || null;
    await q("update lessons set date = $1, status = $2, notes = $3, cycle_id = $4 where id = $5",
      [patch.date ?? row.date, status, notes, cycleId, id]);
    return getLesson(q, id);
  });
}

export async function deleteLesson(db: Db, ownerId: string, id: string) {
  await db.tx(async (q) => {
    await lockLesson(q, ownerId, id);
    await q("delete from lessons where id = $1", [id]); // sort de son cycle avec elle (lessonIds est calculé)
  });
}
