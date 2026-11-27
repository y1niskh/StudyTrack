import { useId, useState, type FormEvent } from "react";
import { WEEKDAYS } from "../lib/slots";
import type { SlotInput } from "../types";

const cap = (d: string) => d[0].toUpperCase() + d.slice(1);
/* Lundi en premier, dimanche à la fin (ordre habituel de la semaine) */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/* Formulaire « cours chaque semaine » : on l'écrit une seule fois, le site l'affiche ensuite chaque semaine.
   On peut cocher plusieurs jours (par exemple lundi 16:00 et jeudi 17:30) : un envoi par jour (route POST /slots),
   tous pour le même élève, la même matière et le même enseignant.
   Un nouvel élève (ou une nouvelle matière, un nouvel enseignant) est créé automatiquement. */
export default function SlotForm({ students, subjects, teachers, busy, onSubmit, onCancel, initial, submitLabel = "Ajouter ce cours" }: {
  students: string[]; subjects: string[]; teachers: string[]; busy: boolean; onSubmit: (list: SlotInput[]) => void; onCancel?: () => void;
  initial?: { studentName?: string; subjectName?: string; teacherName?: string }; submitLabel?: string;
}) {
  const uid = useId();
  const [v, setV] = useState({ studentName: initial?.studentName ?? "", subjectName: initial?.subjectName ?? "", teacherName: initial?.teacherName ?? "", cycleSize: "4", price: "" });
  const [times, setTimes] = useState<Record<number, string>>({}); // jour coché → heure
  const [err, setErr] = useState("");
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  const days = DAY_ORDER.filter((d) => d in times);
  const toggle = (d: number) => setTimes((t) => { const n = { ...t }; if (d in n) delete n[d]; else n[d] = Object.values(t).at(-1) ?? "16:00"; return n; });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!v.studentName.trim() || !v.subjectName.trim() || !v.teacherName.trim()) return setErr("Écris le nom de l'élève, la matière et le nom de l'enseignant.");
    if (days.length === 0) return setErr("Coche au moins un jour de la semaine.");
    const missing = days.find((d) => !times[d]);
    if (missing !== undefined) return setErr(`Indique l'heure du cours du ${WEEKDAYS[missing]}.`);
    const size = Number(v.cycleSize);
    if (!Number.isInteger(size) || size < 1) return setErr("Le nombre de cours par paiement doit être un nombre entier, par exemple 4.");
    const price = v.price.trim() === "" ? undefined : Number(v.price);
    if (price !== undefined && (!Number.isFinite(price) || price < 0)) return setErr("Le prix doit être un nombre, par exemple 6000 (sans « DA »).");
    setErr("");
    onSubmit(days.map((weekday) => ({ studentName: v.studentName, subjectName: v.subjectName, teacherName: v.teacherName, weekday, time: times[weekday], cycleSize: size, price })));
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
          <legend className="label">Quels jours ? <span className="req">*</span> <span className="opt-tag">(un ou plusieurs)</span></legend>
          <div className="choices">
            {DAY_ORDER.map((d) => (
              <label key={d} className="choice">
                <input type="checkbox" checked={d in times} onChange={() => toggle(d)} />
                <span>{cap(WEEKDAYS[d])}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {days.length === 0 ? <p className="hint">Coche le ou les jours où le cours a lieu ; tu pourras ensuite choisir l'heure de chaque jour.</p> : (
          <div className="form-row">
            {days.map((d) => (
              <div key={d} className="field">
                <label htmlFor={`${uid}-t${d}`}>Heure du {WEEKDAYS[d]} <span className="req">*</span></label>
                <input id={`${uid}-t${d}`} className="input" type="time" value={times[d]} onChange={(e) => setTimes((t) => ({ ...t, [d]: e.target.value }))} />
              </div>
            ))}
          </div>
        )}
      </fieldset>
      <fieldset className="form-section">
        <legend>Paiement</legend>
        <div className="form-row">
          <div className="field"><label htmlFor={`${uid}-c`}>Nombre de cours par paiement <span className="req">*</span></label><input id={`${uid}-c`} className="input" type="number" min={1} inputMode="numeric" value={v.cycleSize} onChange={set("cycleSize")} /></div>
          <div className="field"><label htmlFor={`${uid}-p`}>Prix de ce paiement, en DA <span className="opt-tag">(facultatif)</span></label><input id={`${uid}-p`} className="input" type="number" min={0} inputMode="numeric" value={v.price} onChange={set("price")} placeholder="6000" /></div>
        </div>
        <p className="hint">On paie l'enseignant au premier cours, pour ce nombre de cours. Si l'élève suit déjà cette matière avec cet enseignant, le nombre de cours et le prix déjà enregistrés sont gardés.</p>
      </fieldset>
      {err && <p className="field-error" role="alert">{err}</p>}
      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Un instant…" : submitLabel}</button>
        {onCancel && <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={busy}>Annuler</button>}
      </div>
    </form>
  );
}
