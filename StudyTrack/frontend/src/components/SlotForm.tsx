import { useId, useState, type FormEvent } from "react";
import { WEEKDAYS } from "../lib/slots";
import type { SlotInput } from "../types";
import "./SlotForm.css";

/* On écrit le cours UNE seule fois : élève, matière, enseignant, jour et heure. Il se répète ensuite chaque semaine. */
export default function SlotForm({ students, subjects, teachers, busy, onSubmit }: {
  students: string[]; subjects: string[]; teachers: string[]; busy: boolean; onSubmit: (v: SlotInput) => void;
}) {
  const uid = useId();
  const [v, setV] = useState({ studentName: "", subjectName: "", teacherName: "", weekday: -1, time: "16:00", cycleSize: "4", price: "" });
  const [err, setErr] = useState("");
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    const cycle = Number(v.cycleSize); const price = v.price.trim() === "" ? undefined : Number(v.price);
    if (!v.studentName.trim()) return setErr("Écris le prénom de l'élève.");
    if (!v.subjectName.trim()) return setErr("Écris la matière.");
    if (!v.teacherName.trim()) return setErr("Écris le nom de l'enseignant.");
    if (v.weekday < 0) return setErr("Choisis le jour de la semaine.");
    if (!v.time) return setErr("Indique l'heure.");
    if (!Number.isInteger(cycle) || cycle < 1) return setErr("Le nombre de cours avant paiement doit être 1 ou plus.");
    if (price !== undefined && (!Number.isFinite(price) || price < 0)) return setErr("Le prix doit être un nombre.");
    setErr("");
    onSubmit({ studentName: v.studentName, subjectName: v.subjectName, teacherName: v.teacherName, weekday: v.weekday, time: v.time, cycleSize: cycle, price });
  }

  const text = (k: "studentName" | "subjectName" | "teacherName", label: string, list: string[], ph: string) => (
    <div className="lf-field">
      <label htmlFor={`${uid}-${k}`}>{label}</label>
      <input id={`${uid}-${k}`} list={`${uid}-${k}-l`} value={v[k]} onChange={set(k)} placeholder={ph} autoComplete="off" />
      <datalist id={`${uid}-${k}-l`}>{list.map((x) => <option key={x} value={x} />)}</datalist>
    </div>
  );

  return (
    <form className="lf" onSubmit={submit} noValidate>
      {text("studentName", "Élève", students, "ex. Sara")}
      {text("subjectName", "Matière", subjects, "ex. Maths")}
      {text("teacherName", "Enseignant", teachers, "ex. M. Arris")}
      <fieldset className="lf-status">
        <legend>Quel jour ?</legend>
        {WEEKDAYS.map((d, i) => (
          <label key={d} className="opt wd">
            <input type="radio" name={`${uid}-wd`} checked={v.weekday === i} onChange={() => setV((x) => ({ ...x, weekday: i }))} /> {d[0].toUpperCase() + d.slice(1)}
          </label>
        ))}
      </fieldset>
      <div className="lf-two">
        <div className="lf-field"><label htmlFor={`${uid}-t`}>À quelle heure ?</label><input id={`${uid}-t`} type="time" value={v.time} onChange={set("time")} /></div>
        <div className="lf-field"><label htmlFor={`${uid}-c`}>Paiement tous les</label><input id={`${uid}-c`} type="number" min={1} inputMode="numeric" value={v.cycleSize} onChange={set("cycleSize")} /></div>
      </div>
      <p className="lf-hint">cours (4 par défaut). Si ce cours existe déjà, ce nombre ne change pas.</p>
      <div className="lf-field"><label htmlFor={`${uid}-p`}>Prix du paiement, en DA (facultatif)</label><input id={`${uid}-p`} type="number" min={0} inputMode="numeric" value={v.price} onChange={set("price")} /></div>
      {err && <p className="lf-error" role="alert">{err}</p>}
      <div className="lf-actions"><button className="primary" type="submit" disabled={busy}>{busy ? "Un instant…" : "Ajouter ce cours chaque semaine"}</button></div>
    </form>
  );
}
