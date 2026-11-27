import { useId, useState, type FormEvent } from "react";
import type { Enrollment } from "../types";

/* Modifier le nombre de cours avant paiement et le prix d'une matière suivie par un élève. */
export default function EnrollmentForm({ e, busy, onSave, onCancel }: { e: Enrollment; busy: boolean; onSave: (cycleSize: number, price: number | null) => void; onCancel: () => void }) {
  const uid = useId();
  const [size, setSize] = useState(String(e.cycleSize));
  const [price, setPrice] = useState(e.price === undefined ? "" : String(e.price));
  const [err, setErr] = useState("");
  function submit(ev: FormEvent) {
    ev.preventDefault();
    const n = Number(size);
    if (!Number.isInteger(n) || n < 1) return setErr("Le nombre de cours par paiement doit être un nombre entier, par exemple 4.");
    const p = price.trim() === "" ? null : Number(price);
    if (p !== null && (!Number.isFinite(p) || p < 0)) return setErr("Le prix doit être un nombre, par exemple 6000 (sans « DA »).");
    setErr(""); onSave(n, p);
  }
  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="form-row">
        <div className="field"><label htmlFor={`${uid}-s`}>Nombre de cours par paiement <span className="req">*</span></label><input id={`${uid}-s`} className="input" type="number" min={1} inputMode="numeric" value={size} onChange={(x) => setSize(x.target.value)} /></div>
        <div className="field"><label htmlFor={`${uid}-p`}>Prix du paiement, en DA <span className="opt-tag">(facultatif)</span></label><input id={`${uid}-p`} className="input" type="number" min={0} inputMode="numeric" value={price} onChange={(x) => setPrice(x.target.value)} placeholder="6000" /></div>
      </div>
      <p className="hint">On paie l'enseignant au premier cours, pour ce nombre de cours. Les paiements déjà faits ne changent pas. Le nouveau prix compte pour les paiements pas encore faits. Laisse le prix vide pour le retirer.</p>
      {err && <p className="field-error" role="alert">{err}</p>}
      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Un instant…" : "Enregistrer les modifications"}</button>
        <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={busy}>Annuler</button>
      </div>
    </form>
  );
}
