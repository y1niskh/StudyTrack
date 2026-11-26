import { useCallback, useEffect, useState } from "react";
import { fetchDashboard } from "../services/api";
import { ApiError } from "../services/auth";
import type { DashboardData } from "../types";

/* Chargement des données + exécution d'une action, commun à toutes les pages.
   `run(action, messageOk)` : appelle le serveur, affiche le message vert, recharge les données ;
   en cas d'échec, affiche l'explication renvoyée par le serveur. Renvoie true si tout s'est bien passé. */
export function useAppData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const d = await fetchDashboard(); setData(d); setError(""); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Vérifie la connexion Internet, puis appuie sur « Réessayer »."); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function run(job: () => Promise<unknown>, ok: string, fail = "L'opération n'a pas abouti. Vérifie la connexion Internet et réessaie.") {
    setBusy(true); setError(""); setNotice("");
    try { await job(); setNotice(ok); await load(); return true; }
    catch (e) { setError(e instanceof ApiError ? e.message : fail); return false; }
    finally { setBusy(false); }
  }

  return { data, error, notice, busy, load, run, clearNotice: () => setNotice(""), clearError: () => setError("") };
}

/** Montant en dinars, écrit à la française : « 2 000 DA ». */
export const money = (n: number) => `${n.toLocaleString("fr-FR")} DA`;
/** Date en toutes lettres : fmt(date, { weekday: "long", day: "numeric", month: "long" }). */
export const fmt = (d: Date | string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", o).format(new Date(d));
export const cap = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);
