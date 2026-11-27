import { compact, type Db, type Query } from "../../db.ts";
import { HttpError } from "../../errors.ts";
import type { MarkPaidBody } from "./schema.ts";

export const NOT_FOUND = "Ce paiement n'existe plus.";

// lessonIds : les séances du cycle (lessons.cycle_id), dans l'ordre des dates, en texte.
const SELECT = `
  select c.id, c.enrollment_id as "enrollmentId", c.number,
         coalesce((select array_agg(l.id::text order by l.date) from lessons l where l.cycle_id = c.id), '{}') as "lessonIds",
         c.amount, c.status, c.paid_at as "paidAt", c.events
  from payment_cycles c`;

export async function listCycles(db: Db, ownerId: string) {
  return (await db.query(`${SELECT} where c.owner_id = $1 order by c.enrollment_id, c.number`, [ownerId])).rows.map(compact);
}

const getCycle = async (q: Query, id: string) => compact((await q(`${SELECT} where c.id = $1`, [id])).rows[0]);

/** Règle 2 (paiement au premier cours) : le premier cycle pas plein de l'inscription (par numéro croissant), parmi les
    cycles non payés et le dernier cycle même s'il est déjà payé (payé dès sa 1re séance, il se complète ensuite).
    Un ancien cycle payé (qui n'est plus le dernier) ne reçoit jamais de séance. S'il n'y en a pas : un nouveau cycle
    (numéro suivant, montant = prix de l'inscription). À appeler dans une transaction qui a verrouillé l'inscription :
    deux séances confirmées en même temps ne peuvent pas prendre la même dernière place. */
export async function cycleFor(q: Query, ownerId: string, enrollmentId: string): Promise<string> {
  const open = (await q(
    `select c.id from payment_cycles c join enrollments e on e.id = c.enrollment_id
     where c.enrollment_id = $1 and c.owner_id = $2
       and (select count(*) from lessons l where l.cycle_id = c.id) < e.cycle_size
       and (c.status = 'unpaid' or c.number = (select max(number) from payment_cycles where enrollment_id = c.enrollment_id))
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

/** Verrouille l'inscription du cycle (règle 4), puis renvoie le cycle avec sa taille et son nombre de séances. */
async function lockCycle(q: Query, ownerId: string, id: string) {
  await q(
    `select e.id from enrollments e join payment_cycles c on c.enrollment_id = e.id
     where c.id = $1 and c.owner_id = $2 for update of e`,
    [id, ownerId],
  );
  const row = (await q(
    `select c.status, e.cycle_size, (select count(*)::int from lessons l where l.cycle_id = c.id) as lessons
     from payment_cycles c join enrollments e on e.id = c.enrollment_id
     where c.id = $1 and c.owner_id = $2`,
    [id, ownerId],
  )).rows[0];
  if (!row) throw new HttpError(404, NOT_FOUND);
  return row;
}

// Trace d'audit : on ajoute toujours à la fin de `events`, on n'en retire jamais rien (règle 6).
const ADD_EVENT = "events = events || jsonb_build_array(jsonb_build_object('type', $2::text, 'at', $3::text))";

export async function markPaid(db: Db, ownerId: string, id: string, body: MarkPaidBody) {
  return db.tx(async (q) => {
    const c = await lockCycle(q, ownerId, id);
    if (c.status === "paid") throw new HttpError(409, "Ce cycle est déjà marqué comme payé.");
    // Paiement au premier cours : il suffit que le cycle ait commencé (au moins une séance effectuée).
    if (c.lessons < 1) throw new HttpError(409, "Ce cycle n'a encore aucun cours.");
    const now = new Date().toISOString();
    const paidAt = body.paidAt ? new Date(body.paidAt).toISOString() : now;
    await q(`update payment_cycles set status = 'paid', paid_at = $4, ${ADD_EVENT} where id = $1`, [id, "paid", now, paidAt]);
    return getCycle(q, id);
  });
}

/** Correction d'un paiement fait par erreur : le cycle redevient à payer, ses séances restent dedans (et redeviennent
    modifiables). Rien n'est effacé de l'historique. */
export async function markUnpaid(db: Db, ownerId: string, id: string) {
  return db.tx(async (q) => {
    const c = await lockCycle(q, ownerId, id);
    if (c.status !== "paid") throw new HttpError(409, "Ce cycle n'est pas marqué comme payé.");
    await q(`update payment_cycles set status = 'unpaid', paid_at = null, ${ADD_EVENT} where id = $1`,
      [id, "unpaid", new Date().toISOString()]);
    return getCycle(q, id);
  });
}
