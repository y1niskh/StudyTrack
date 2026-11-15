import type { DashboardData } from "../types";

/** Télécharge une copie de toutes les données (fichier .json) : élèves, cours, paiements. Fabriquée dans le navigateur, sans appel au serveur. */
export function downloadBackup(data: DashboardData | null) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = `studytrack-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  a.click(); URL.revokeObjectURL(a.href);
}
