import { useState } from "react";
import { downloadBackup } from "../lib/backup";
import { resetYear } from "../services/api";
import { ApiError } from "../services/auth";
import type { DashboardData } from "../types";
import Icon from "./Icon";
import { Confirm } from "./Modal";
import { Notice } from "./ui";

/* « Nouvelle année », dans la page Réglages : efface élèves, enseignants, matières, cours et paiements, après confirmation.
   `data` sert uniquement à proposer une copie de sauvegarde avant l'effacement. */
export default function NewYearReset({ data, onDone }: { data: DashboardData | null; onDone: () => void | Promise<void> }) {
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function confirm() {
    setBusy(true); setError("");
    try { await resetYear(); setAsk(false); setDone(true); await onDone(); }
    catch (e) { setError(e instanceof ApiError ? e.message : "L'effacement n'a pas abouti. Vérifie la connexion Internet et réessaie. Rien n'a été effacé."); }
    finally { setBusy(false); }
  }

  return (
    <section className="card danger-card" aria-labelledby="h-year">
      <div className="card-head"><h2 id="h-year">Nouvelle année</h2></div>
      <div className="card-body">
        <p className="card-text">À utiliser une fois par an, pour repartir de zéro. Efface <strong>tous</strong> les élèves, enseignants, matières, cours et paiements. Ton compte est gardé.</p>
        {done && <Notice kind="success" onClose={() => setDone(false)}>Tout a été effacé. Tu peux commencer la nouvelle année.</Notice>}
        <button type="button" className="btn btn-danger-outline" onClick={() => { setDone(false); setAsk(true); }}><Icon n="trash" /> Commencer une nouvelle année</button>
      </div>
      <Confirm open={ask} title="Tout effacer ?" confirmLabel="Oui, tout effacer" cancelLabel="Non, garder mes données" tone="danger" busy={busy}
        onCancel={() => { setAsk(false); setError(""); }} onConfirm={() => void confirm()}
        extra={<button type="button" className="btn btn-secondary btn-block reset-backup" onClick={() => downloadBackup(data)}><Icon n="download" /> Télécharger une copie avant</button>}>
        {error && <Notice kind="error">{error}</Notice>}
        <Notice kind="warning"><strong>Attention : on ne pourra pas revenir en arrière.</strong> Tous les élèves, cours et paiements seront effacés.</Notice>
        <p>Conseil : télécharge d'abord une copie de sauvegarde.</p>
      </Confirm>
    </section>
  );
}
