import { compact, type Db } from "../../db.ts";

// lessonIds : les séances du cycle (lessons.cycle_id), dans l'ordre des dates, en texte.
export async function listCycles(db: Db, ownerId: string) {
  const { rows } = await db.query(
    `select c.id, c.enrollment_id as "enrollmentId", c.number,
            coalesce((select array_agg(l.id::text order by l.date) from lessons l where l.cycle_id = c.id), '{}') as "lessonIds",
            c.amount, c.status, c.paid_at as "paidAt", c.events
     from payment_cycles c where c.owner_id = $1 order by c.enrollment_id, c.number`,
    [ownerId],
  );
  return rows.map(compact);
}
