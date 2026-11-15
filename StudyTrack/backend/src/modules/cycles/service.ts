import { compact, type Db, type Query } from "../../db.ts";

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

/** Règle 2 : le premier cycle non payé et pas plein de l'inscription (par numéro croissant) ; s'il n'y en a pas, un
    nouveau cycle (numéro suivant, montant = prix de l'inscription). À appeler dans une transaction qui a verrouillé
    l'inscription : deux séances confirmées en même temps ne peuvent pas prendre la même dernière place. */
export async function cycleFor(q: Query, ownerId: string, enrollmentId: string): Promise<string> {
  const open = (await q(
    `select c.id from payment_cycles c join enrollments e on e.id = c.enrollment_id
     where c.enrollment_id = $1 and c.owner_id = $2 and c.status = 'unpaid'
       and (select count(*) from lessons l where l.cycle_id = c.id) < e.cycle_size
     order by c.number limit 1`,
    [enrollmentId, ownerId],
  )).rows[0];
  if (open) return open.id;
  return (await q(
    `insert into payment_cycles (owner_id, enrollment_id, number, amount)
     select $2, e.id, coalesce((select max(number) from payment_cycles where enrollment_id = e.id), 0) + 1, e.price
     from enrollments e where e.id = $1
     returning id`,
    [enrollmentId, ownerId],
  )).rows[0].id;
}
