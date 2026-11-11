import { useId, useState, type FormEvent, type ReactNode } from "react";
import { STATUS_LABEL } from "../lib/lessons";
import type { Enrollment, LessonStatus } from "../types";
import "./LessonForm.css";

export interface LessonValues { enrollmentId: string; date: string; time: string; status: LessonStatus; notes: string }
const STATUSES: LessonStatus[] = ["planned", "completed", "cancelled"];

/* Formulaire unique pour ajouter un cours (avec le choix du cours suivi) ou le modifier (sans). */
export default function LessonForm({ enrollments, initial, submitLabel, busy, onSubmit, onCancel, extra }: {
  enrollments?: Enrollment[]; initial: LessonValues; submitLabel: string; busy: boolean;
  onSubmit: (v: LessonValues) => void; onCancel?: () => void; extra?: ReactNode;
}) {
  const uid = useId();
  const [v, setV] = useState(initial);
  const [err, setErr] = useState("");
  const set = (k: keyof LessonValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((x) => ({ ...x, [k]: e.target.value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    if (enrollments && !v.enrollmentId) return setErr("Choisis l'élève et la matière.");
    if (!v.date || !v.time) return setErr("Indique la date et l'heure.");
    setErr(""); onSubmit(v);
  }
  const sorted = [...(enrollments ?? [])].sort((a, b) => a.studentName.localeCompare(b.studentName) || a.subjectName.localeCompare(b.subjectName));

  return (
    <form className="lf" onSubmit={submit} noValidate>
      {enrollments && (
        <div className="lf-field">
          <label htmlFor={`${uid}-enr`}>Élève et matière</label>
          <select id={`${uid}-enr`} value={v.enrollmentId} onChange={set("enrollmentId")}>
            <option value="">Choisis…</option>
            {sorted.map((e) => <option key={e.id} value={e.id}>{e.studentName}, {e.subjectName} (avec {e.teacherName})</option>)}
          </select>
        </div>
      )}
      <div className="lf-two">
        <div className="lf-field"><label htmlFor={`${uid}-d`}>Date</label><input id={`${uid}-d`} type="date" value={v.date} onChange={set("date")} /></div>
        <div className="lf-field"><label htmlFor={`${uid}-t`}>Heure</label><input id={`${uid}-t`} type="time" value={v.time} onChange={set("time")} /></div>
      </div>
      <fieldset className="lf-status">
        <legend>Statut</legend>
        {STATUSES.map((s) => (
          <label key={s} className={`opt ${s}`}>
            <input type="radio" name={`${uid}-st`} checked={v.status === s} onChange={() => setV((x) => ({ ...x, status: s }))} /> {STATUS_LABEL[s]}
          </label>
        ))}
      </fieldset>
      <div className="lf-field"><label htmlFor={`${uid}-n`}>Notes (facultatif)</label><input id={`${uid}-n`} type="text" value={v.notes} onChange={set("notes")} maxLength={200} /></div>
      {err && <p className="lf-error" role="alert">{err}</p>}
      <div className="lf-actions">
        <button className="primary" type="submit" disabled={busy}>{busy ? "Un instant…" : submitLabel}</button>
        {onCancel && <button className="ghost" type="button" onClick={onCancel} disabled={busy}>Annuler</button>}
        {extra}
      </div>
    </form>
  );
}
