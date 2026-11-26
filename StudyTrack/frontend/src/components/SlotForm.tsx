import { useId, useState, type FormEvent } from "react";
import { WEEKDAYS } from "../lib/slots";
import type { SlotInput } from "../types";

/* Formulaire « cours chaque semaine » : on l'écrit une seule fois, le site l'affiche ensuite chaque semaine.
   Un nouvel élève (ou une nouvelle matière, un nouvel enseignant) est créé automatiquement par ce formulaire. */
export default function SlotForm({ students, subjects, teachers, busy, onSubmit, onCancel, initialStudent = "", submitLabel = "Ajouter ce cours" }: {
  students: string[]; subjects: string[]; teachers: string[]; busy: boolean; onSubmit: (v: SlotInput) => void; onCancel?: () => void;
  initialStudent?: string; submitLabel?: string;
}) {
  const uid = useId();
  const [v, setV] = useState({ studentName: initialStudent, subjectName: "", teacherName: "", time: "16:00", cycleSize: "4", price: "" });
  const [weekday, setWeekday] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!v.studentName.trim() || !v.subjectName.trim() || !v.teacherName.trim()) return setErr("Écris le nom de l'élève, la matière et le nom de l'enseignant.");
    if (weekday === null) return setErr("Choisis le jour de la semaine où le cours a lieu.");
    if (!v.time) return setErr("Indique l'heure du cours.");
    const size = Number(v.cycleSize);
    if (!Number.isInteger(size) || size < 1) return setErr("Le nombre de cours avant paiement doit être un nombre entier, par exemple 4.");
    const price = v.price.trim() === "" ? undefined : Number(v.price);
    if (price !== undefined && (!Number.isFinite(price) || price < 0)) return setErr("Le prix doit être un nombre, par exemple 6000 (sans « DA »).");
    setErr(""); onSubmit({ studentName: v.studentName, subjectName: v.subjectName, teacherName: v.teacherName, weekday, time: v.time, cycleSize: size, price });
  }
  const text = (k: "studentName" | "subjectName" | "teacherName", label: string, list: string[], ph: string) => (
    <div className="field">
      <label htmlFor={`${uid}-${k}`}>{label} <span className="req">*</span></label>
      <input id={`${uid}-${k}`} className="input" list={`${uid}-${k}-l`} value={v[k]} onChange={set(k)} placeholder={ph} autoComplete="off" />
      <datalist id={`${uid}-${k}-l`}>{list.map((x) => <option key={x} value={x} />)}</datalist>
    </div>
  );

  return (
    <form className="form" onSubmit={submit} noValidate>
      <p className="req-note"><span className="req">*</span> obligatoire</p>
      <fieldset className="form-section">
        <legend>Qui et quoi</legend>
        {text("studentName", "Élève", students, "Par exemple : Sara")}
        <div className="form-row">
          {text("subjectName", "Matière", subjects, "Par exemple : Maths")}
          {text("teacherName", "Enseignant", teachers, "Par exemple : M. Arris")}
        </div>
      </fieldset>
      <fieldset className="form-section">
        <legend>Quand</legend>
        <fieldset className="form-section">
          <legend className="label">Chaque… <span className="req">*</span></legend>
          <div className="choices">
            {WEEKDAYS.map((d, i) => (
              <label key={d} className="choice">
                <input type="radio" name={`${uid}-wd`} checked={weekday === i} onChange={() => setWeekday(i)} />
                <span>{d[0].toUpperCase() + d.slice(1)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field"><label htmlFor={`${uid}-t`}>À quelle heure <span className="req">*</span></label><input id={`${uid}-t`} className="input" type="time" value={v.time} onChange={set("time")} /></div>
      </fieldset>
      <fieldset className="form-section">
        <legend>Paiement</legend>
        <div className="form-row">
          <div className="field"><label htmlFor={`${uid}-c`}>Payer tous les … cours <span className="req">*</span></label><input id={`${uid}-c`} className="input" type="number" min={1} inputMode="numeric" value={v.cycleSize} onChange={set("cycleSize")} /></div>
          <div className="field"><label htmlFor={`${uid}-p`}>Prix de ce paiement, en DA <span className="opt-tag">(facultatif)</span></label><input id={`${uid}-p`} className="input" type="number" min={0} inputMode="numeric" value={v.price} onChange={set("price")} placeholder="6000" /></div>
        </div>
        <p className="hint">Si cet élève suit déjà cette matière avec cet enseignant, le nombre de cours et le prix déjà enregistrés sont gardés.</p>
      </fieldset>
      {err && <p className="field-error" role="alert">{err}</p>}
      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Un instant…" : submitLabel}</button>
        {onCancel && <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={busy}>Annuler</button>}
      </div>
    </form>
  );
}
