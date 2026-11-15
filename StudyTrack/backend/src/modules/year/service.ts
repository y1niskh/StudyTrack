import type { Db } from "../../db.ts";

/** « Nouvelle année » : efface toutes les données de l'utilisateur, garde le compte. Supprimer les élèves, enseignants et
    matières emporte en cascade les inscriptions, puis leurs créneaux, cycles et séances (voir la migration 001). */
export async function resetYear(db: Db, ownerId: string) {
  await db.tx(async (q) => {
    for (const table of ["students", "teachers", "subjects"]) {
      await q(`delete from ${table} where owner_id = $1`, [ownerId]);
    }
  });
}
