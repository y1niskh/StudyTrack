import { useState } from "react";
import { resetYear } from "../services/api";
import { ApiError } from "../services/auth";
import type { DashboardData } from "../types";
import "./NewYearReset.css";

/* PARQUÉ pour l'étape « Paramètres » : bouton « Nouvelle année » (retiré du tableau de bord).
   Il efface élèves, enseignants, matières, cours et paiements, après confirmation.
   Usage prévu : <NewYearReset data={data} onDone={reload} /> dans la page Paramètres.
   `data` sert uniquement à proposer une copie de sauvegarde avant l'effacement. */
export default function NewYearReset({ data, onDone }: { data: DashboardData | null; onDone: () => void | Promise<void> }) {
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function backup() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = `studytrack-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  }

  async function confirm() {
    setBusy(true); setError("");
    try { await resetYear(); setAsk(false); await onDone(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "La remise à zéro a échoué."); }
    finally { setBusy(false); }
  }

  return (
    <section className="year-note" aria-labelledby="h-year">
      <i className="magnet" aria-hidden="true" />
      <h2 id="h-year">Nouvelle année</h2>
      <p>Tout est gardé jusqu'à ce que tu appuies ici. Ce bouton efface les élèves, les enseignants, les matières, les cours et les paiements.</p>
      {error && <p className="year-error" role="alert">{error}</p>}
      {!ask ? (
        <button className="ghost" onClick={() => setAsk(true)}>Nouvelle année</button>
      ) : (
        <div className="year-confirm" role="alertdialog" aria-labelledby="h-year" aria-describedby="year-warn">
          <p id="year-warn" className="year-error">Attention : tout sera effacé et on ne pourra pas revenir en arrière.</p>
          <button className="ghost" onClick={backup}>Télécharger une copie avant</button>
          <button className="primary year-danger" disabled={busy} onClick={() => void confirm()}>{busy ? "Un instant…" : "Oui, tout effacer"}</button>
          <button className="ghost" disabled={busy} onClick={() => setAsk(false)}>Non, garder mes données</button>
        </div>
      )}
    </section>
  );
}
