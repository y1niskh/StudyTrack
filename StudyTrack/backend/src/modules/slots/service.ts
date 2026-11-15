import type { Db } from "../../db.ts";

export async function listSlots(db: Db, ownerId: string) {
  const { rows } = await db.query(
    `select id, enrollment_id as "enrollmentId", weekday, time, to_char(since, 'YYYY-MM-DD') as since
     from slots where owner_id = $1 order by weekday, time`,
    [ownerId],
  );
  return rows;
}
