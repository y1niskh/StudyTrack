import { useId, useState, type FormEvent, type ReactNode } from "react";
import { STATUS_LABEL } from "../lib/lessons";
import type { Enrollment, LessonStatus } from "../types";

export interface LessonValues { enrollmentId: string; date: string; time: string; status: LessonStatus; notes: string }
const STATUSES: LessonStatus[] = ["planned", "completed", "cancelled"];

/* Formulaire unique pour ajouter un cours (avec le choix de l'élève et de la matière) ou le modifier (sans). */
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
    if (enrollments && !v.enrollmentId) return setErr("Choisis l'élève et la matière dans la liste.");
    if (!v.date || !v.time) return setErr("Indique la date et l'heure du cours.");
    setErr(""); onSubmit(v);
  }
  const sorted = [...(enrollments ?? [])].sort((a, b) => a.studentName.localeCompare(b.studentName) || a.subjectName.localeCompare(b.subjectName));

  return (
    <form className="form" onSubmit={submit} noValidate>
      {enrollments && (
        <div className="field">
          <label htmlFor={`${uid}-enr`}>Élève et matière <span className="req">*</span></label>
          <select id={`${uid}-enr`} className="input" value={v.enrollmentId} onChange={set("enrollmentId")}>
            <option value="">Choisir dans la liste…</option>
            {sorted.map((e) => <option key={e.id} value={e.id}>{e.studentName} · {e.subjectName} (avec {e.teacherName})</option>)}
          </select>
        </div>
      )}
      <div className="form-row">
        <div className="field"><label htmlFor={`${uid}-d`}>Date <span className="req">*</span></label><input id={`${uid}-d`} className="input" type="date" value={v.date} onChange={set("date")} /></div>
        <div className="field"><label htmlFor={`${uid}-t`}>Heure <span className="req">*</span></label><input id={`${uid}-t`} className="input" type="time" value={v.time} onChange={set("time")} /></div>
      </div>
      <fieldset className="form-section">
        <legend className="label">Le cours a-t-il eu lieu ?</legend>
        <div className="choices">
          {STATUSES.map((s) => (
            <label key={s} className="choice">
              <input type="radio" name={`${uid}-st`} checked={v.status === s} onChange={() => setV((x) => ({ ...x, status: s }))} />
              <span>{STATUS_LABEL[s]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor={`${uid}-n`}>Remarque <span className="opt-tag">(facultatif)</span></label>
        <input id={`${uid}-n`} className="input" type="text" value={v.notes} onChange={set("notes")} maxLength={200} placeholder="Par exemple : chapitre 3" />
      </div>
      {err && <p className="field-error" role="alert">{err}</p>}
      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Un instant…" : submitLabel}</button>
        {onCancel && <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={busy}>Annuler</button>}
      </div>
      {extra}
    </form>
  );
}
