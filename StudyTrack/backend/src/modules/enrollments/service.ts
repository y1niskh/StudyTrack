import { compact, type Db, type Query } from "../../db.ts";
import { HttpError } from "../../errors.ts";
import type { EnrollmentCreate, EnrollmentPatch } from "./schema.ts";

export const NOT_FOUND = "Ce cours suivi n'existe pas.";

// Une inscription « à plat » : avec les noms de l'élève, de l'enseignant et de la matière (contrat §2).
const SELECT = `
  select e.id, s.name as "studentName", t.name as "teacherName", j.name as "subjectName",
         e.cycle_size as "cycleSize", e.price, e.student_id as "studentId", e.teacher_id as "teacherId",
         e.subject_id as "subjectId", e.active
  from enrollments e
  join students s on s.id = e.student_id
  join teachers t on t.id = e.teacher_id
  join subjects j on j.id = e.subject_id`;

export async function listEnrollments(db: Db, ownerId: string) {
  const { rows } = await db.query(`${SELECT} where e.owner_id = $1 order by s.name, j.name`, [ownerId]);
  return rows.map(compact);
}

async function getEnrollment(q: Query, ownerId: string, id: string) {
  const row = (await q(`${SELECT} where e.owner_id = $1 and e.id = $2`, [ownerId, id])).rows[0];
  if (!row) throw new HttpError(404, NOT_FOUND);
  return compact(row);
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

/** Retrouve ou crée l'élève, l'enseignant, la matière puis le cours suivi, et le verrouille (règle 4).
    cycleSize et price ne servent qu'à la création : un cours suivi qui existe déjà garde ses réglages.
    Utilisé par POST /slots (cours chaque semaine) et POST /enrollments (cours ponctuel). */
export async function findOrCreateEnrollment(q: Query, ownerId: string, input: EnrollmentCreate) {
  const student = await findOrCreate(q, "students", ownerId, input.studentName);
  const teacher = await findOrCreate(q, "teachers", ownerId, input.teacherName);
  const subject = await findOrCreate(q, "subjects", ownerId, input.subjectName);
  await q(
    `insert into enrollments (owner_id, student_id, teacher_id, subject_id, cycle_size, price)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (owner_id, student_id, teacher_id, subject_id) do nothing`,
    [ownerId, student, teacher, subject, input.cycleSize, input.price ?? null],
  );
  return (await q(
    "select id from enrollments where owner_id = $1 and student_id = $2 and teacher_id = $3 and subject_id = $4 for update",
    [ownerId, student, teacher, subject],
  )).rows[0].id as string;
}

/** Cours ponctuel avec un enseignant ou une matière pas encore enregistrés : le cours suivi, sans jour de la semaine. */
export async function createEnrollment(db: Db, ownerId: string, input: EnrollmentCreate) {
  return db.tx(async (q) => getEnrollment(q, ownerId, await findOrCreateEnrollment(q, ownerId, input)));
}

/** Change cycleSize et/ou price. Les cycles payés ne changent jamais ; le nouveau prix va dans les cycles non payés ;
    aucune séance ne change de cycle. */
export async function updateEnrollment(db: Db, ownerId: string, id: string, patch: EnrollmentPatch) {
  return db.tx(async (q) => {
    // Verrou sur l'inscription (règle 4) : une séance confirmée en même temps attend la fin de cette modification.
    const locked = await q("select id from enrollments where id = $1 and owner_id = $2 for update", [id, ownerId]);
    if (!locked.rows[0]) throw new HttpError(404, NOT_FOUND);

    if (patch.cycleSize !== undefined) {
      await q("update enrollments set cycle_size = $1 where id = $2", [patch.cycleSize, id]);
    }
    if (patch.price !== undefined) {
      await q("update enrollments set price = $1 where id = $2", [patch.price, id]);
      await q("update payment_cycles set amount = $1 where enrollment_id = $2 and status = 'unpaid'", [patch.price, id]);
    }
    return getEnrollment(q, ownerId, id);
  });
}
