import { useId, useState, type FormEvent } from "react";
import { WEEKDAYS } from "../lib/slots";
import type { SlotInput } from "../types";
import "./LessonForm.css";
import "./SlotForm.css";

/* Formulaire « cours qui se répète » : on l'écrit une seule fois, le site affiche ensuite chaque semaine. */
export default function SlotForm({ students, subjects, teachers, busy, onSubmit }: {
  students: string[]; subjects: string[]; teachers: string[]; busy: boolean; onSubmit: (v: SlotInput) => void;
}) {
  const uid = useId();
  const [v, setV] = useState({ studentName: "", subjectName: "", teacherName: "", time: "16:00", cycleSize: "4", price: "" });
  const [weekday, setWeekday] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!v.studentName.trim() || !v.subjectName.trim() || !v.teacherName.trim()) return setErr("Écris le nom de l'élève, la matière et l'enseignant.");
    if (weekday === null) return setErr("Choisis le jour de la semaine.");
    if (!v.time) return setErr("Indique l'heure.");
    const size = Number(v.cycleSize);
    if (!Number.isInteger(size) || size < 1) return setErr("Le nombre de cours avant paiement doit être un nombre entier, par exemple 4.");
    const price = v.price.trim() === "" ? undefined : Number(v.price);
    if (price !== undefined && (!Number.isFinite(price) || price < 0)) return setErr("Le prix doit être un nombre, par exemple 6000.");
    setErr(""); onSubmit({ studentName: v.studentName, subjectName: v.subjectName, teacherName: v.teacherName, weekday, time: v.time, cycleSize: size, price });
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
      {text("studentName", "Élève", students, "Sara")}
      {text("subjectName", "Matière", subjects, "Maths")}
      {text("teacherName", "Enseignant", teachers, "M. Arris")}
      <fieldset className="lf-status">
        <legend>Chaque…</legend>
        {WEEKDAYS.map((d, i) => (
          <label key={d} className="opt day">
            <input type="radio" name={`${uid}-wd`} checked={weekday === i} onChange={() => setWeekday(i)} /> {d[0].toUpperCase() + d.slice(1)}
          </label>
        ))}
      </fieldset>
      <div className="lf-two">
        <div className="lf-field"><label htmlFor={`${uid}-t`}>À quelle heure</label><input id={`${uid}-t`} type="time" value={v.time} onChange={set("time")} /></div>
        <div className="lf-field"><label htmlFor={`${uid}-c`}>Payer tous les … cours</label><input id={`${uid}-c`} type="number" min={1} inputMode="numeric" value={v.cycleSize} onChange={set("cycleSize")} /></div>
      </div>
      <div className="lf-field"><label htmlFor={`${uid}-p`}>Prix pour ce paiement, en DA (facultatif)</label><input id={`${uid}-p`} type="number" min={0} inputMode="numeric" value={v.price} onChange={set("price")} placeholder="6000" /></div>
      <p className="lf-hint">Si ce cours existe déjà, le nombre de cours avant paiement ne change pas.</p>
      {err && <p className="lf-error" role="alert">{err}</p>}
      <div className="lf-actions"><button className="primary" type="submit" disabled={busy}>{busy ? "Un instant…" : "Ajouter ce cours chaque semaine"}</button></div>
    </form>
  );
}
