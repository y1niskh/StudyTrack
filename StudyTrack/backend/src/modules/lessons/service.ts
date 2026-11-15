import { compact, type Db } from "../../db.ts";

// `occurrence` est une date locale : rendue telle quelle en texte "AAAA-MM-JJ", jamais via un Date JavaScript (décalage).
export async function listLessons(db: Db, ownerId: string) {
  const { rows } = await db.query(
    `select id, enrollment_id as "enrollmentId", date, status, notes, slot_id as "slotId",
            to_char(occurrence, 'YYYY-MM-DD') as occurrence
     from lessons where owner_id = $1 order by date`,
    [ownerId],
  );
  return rows.map(compact);
}
