import type { Db, Query } from "../../db.ts";
import { HttpError } from "../../errors.ts";
import type { SlotCreate } from "./schema.ts";

export const NOT_FOUND = "Ce cours qui se répète n'existe plus.";

const SELECT = `select id, enrollment_id as "enrollmentId", weekday, time, to_char(since, 'YYYY-MM-DD') as since from slots`;

export async function listSlots(db: Db, ownerId: string) {
  return (await db.query(`${SELECT} where owner_id = $1 order by weekday, time`, [ownerId])).rows;
}

/** Retrouve un élève, un enseignant ou une matière par son nom (sans tenir compte des majuscules ni des espaces autour,
    grâce à l'index unique sur lower(name)), ou le crée. */
async function findOrCreate(q: Query, table: "students" | "teachers" | "subjects", ownerId: string, name: string) {
  return (await q(
    `insert into ${table} (owner_id, name) values ($1, $2)
     on conflict (owner_id, lower(name)) do update set name = ${table}.name
     returning id`,
    [ownerId, name],
  )).rows[0].id as string;
}

export async function createSlot(db: Db, ownerId: string, input: SlotCreate) {
  return db.tx(async (q) => {
    const student = await findOrCreate(q, "students", ownerId, input.studentName);
    const teacher = await findOrCreate(q, "teachers", ownerId, input.teacherName);
    const subject = await findOrCreate(q, "subjects", ownerId, input.subjectName);
    await q(
      `insert into enrollments (owner_id, student_id, teacher_id, subject_id, cycle_size, price)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (owner_id, student_id, teacher_id, subject_id) do nothing`,
      [ownerId, student, teacher, subject, input.cycleSize, input.price ?? null],
    );
    const enrollment = (await q(
      "select id from enrollments where owner_id = $1 and student_id = $2 and teacher_id = $3 and subject_id = $4 for update",
      [ownerId, student, teacher, subject],
    )).rows[0].id;

    const dup = await q("select id from slots where enrollment_id = $1 and weekday = $2 and time = $3", [enrollment, input.weekday, input.time]);
    if (dup.rows[0]) throw new HttpError(409, "Ce cours existe déjà à ce jour et à cette heure.");
    const { rows } = await q(
      "insert into slots (owner_id, enrollment_id, weekday, time) values ($1, $2, $3, $4) returning id",
      [ownerId, enrollment, input.weekday, input.time],
    );
    return (await q(`${SELECT} where id = $1`, [rows[0].id])).rows[0];
  });
}

/** Arrête un cours qui se répète : ses séances prévues à venir disparaissent ; le passé, les séances effectuées ou
    annulées restent (elles perdent seulement leur lien vers le créneau). */
export async function deleteSlot(db: Db, ownerId: string, id: string) {
  await db.tx(async (q) => {
    const slot = await q("select id from slots where id = $1 and owner_id = $2 for update", [id, ownerId]);
    if (!slot.rows[0]) throw new HttpError(404, NOT_FOUND);
    await q("delete from lessons where slot_id = $1 and status = 'planned' and date > now()", [id]);
    await q("delete from slots where id = $1", [id]);
  });
}
