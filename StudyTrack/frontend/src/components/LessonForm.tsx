import { useId, useState, type FormEvent, type ReactNode } from "react";
import { STATUS_LABEL } from "../lib/lessons";
import type { Enrollment, LessonStatus } from "../types";

/** Un cours ponctuel avec un enseignant ou une matière pas encore enregistrés : 1 cours = 1 paiement, à ce prix. */
export interface NewCourse { studentName: string; subjectName: string; teacherName: string; price?: number }
export interface LessonValues { enrollmentId: string; date: string; time: string; status: LessonStatus; notes: string; newCourse?: NewCourse }
const STATUSES: LessonStatus[] = ["planned", "completed", "cancelled"];

/* Formulaire unique pour ajouter un cours (avec le choix de l'élève et de la matière) ou le modifier (sans).
   Avec `names`, on peut aussi écrire un nouveau cours (nouvel enseignant, nouvelle matière) et son prix. */
export default function LessonForm({ enrollments, names, initialStudent = "", initial, submitLabel, busy, onSubmit, onCancel, extra }: {
  enrollments?: Enrollment[]; names?: { students: string[]; subjects: string[]; teachers: string[] }; initialStudent?: string;
  initial: LessonValues; submitLabel: string; busy: boolean;
  onSubmit: (v: LessonValues) => void; onCancel?: () => void; extra?: ReactNode;
}) {
  const uid = useId();
  const [v, setV] = useState(initial);
  const [mode, setMode] = useState<"known" | "new">(enrollments && enrollments.length > 0 ? "known" : "new");
  const [n, setN] = useState({ studentName: initialStudent, subjectName: "", teacherName: "", price: "" });
  const [err, setErr] = useState("");
  const set = (k: keyof LessonValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  const setName = (k: keyof typeof n) => (e: React.ChangeEvent<HTMLInputElement>) => setN((x) => ({ ...x, [k]: e.target.value }));
  const adding = !!enrollments;
  const isNew = adding && !!names && mode === "new";

  function submit(e: FormEvent) {
    e.preventDefault();
    let newCourse: NewCourse | undefined;
    if (isNew) {
      if (!n.studentName.trim() || !n.subjectName.trim() || !n.teacherName.trim()) return setErr("Écris le nom de l'élève, la matière et le nom de l'enseignant.");
      const price = n.price.trim() === "" ? undefined : Number(n.price);
      if (price !== undefined && (!Number.isInteger(price) || price < 0)) return setErr("Le prix doit être un nombre entier, par exemple 2000 (sans « DA »).");
      newCourse = { studentName: n.studentName, subjectName: n.subjectName, teacherName: n.teacherName, price };
    } else if (adding && !v.enrollmentId) return setErr("Choisis l'élève et la matière dans la liste.");
    if (!v.date || !v.time) return setErr("Indique la date et l'heure du cours.");
    setErr(""); onSubmit({ ...v, newCourse });
  }
  const sorted = [...(enrollments ?? [])].sort((a, b) => a.studentName.localeCompare(b.studentName) || a.subjectName.localeCompare(b.subjectName));
  const text = (k: "studentName" | "subjectName" | "teacherName", label: string, list: string[], ph: string) => (
    <div className="field">
      <label htmlFor={`${uid}-${k}`}>{label} <span className="req">*</span></label>
      <input id={`${uid}-${k}`} className="input" list={`${uid}-${k}-l`} value={n[k]} onChange={setName(k)} placeholder={ph} autoComplete="off" />
      <datalist id={`${uid}-${k}-l`}>{list.map((x) => <option key={x} value={x} />)}</datalist>
    </div>
  );

  return (
    <form className="form" onSubmit={submit} noValidate>
      {adding && names && sorted.length > 0 && (
        <fieldset className="form-section">
          <legend className="label">Quel cours ?</legend>
          <div className="choices">
            <label className="choice"><input type="radio" name={`${uid}-mode`} checked={mode === "known"} onChange={() => setMode("known")} /><span>Un cours déjà enregistré</span></label>
            <label className="choice"><input type="radio" name={`${uid}-mode`} checked={mode === "new"} onChange={() => setMode("new")} /><span>Nouvel enseignant ou nouvelle matière</span></label>
          </div>
        </fieldset>
      )}
      {adding && !isNew && (
        <div className="field">
          <label htmlFor={`${uid}-enr`}>Élève et matière <span className="req">*</span></label>
          <select id={`${uid}-enr`} className="input" value={v.enrollmentId} onChange={set("enrollmentId")}>
            <option value="">Choisir dans la liste…</option>
            {sorted.map((e) => <option key={e.id} value={e.id}>{e.studentName} · {e.subjectName} (avec {e.teacherName})</option>)}
          </select>
        </div>
      )}
      {isNew && names && (
        <fieldset className="form-section">
          <legend>Le cours</legend>
          {text("studentName", "Élève", names.students, "Par exemple : Sara")}
          <div className="form-row">
            {text("subjectName", "Matière", names.subjects, "Par exemple : Physique")}
            {text("teacherName", "Enseignant", names.teachers, "Par exemple : Mme Kaci")}
          </div>
          <div className="field">
            <label htmlFor={`${uid}-price`}>Prix de ce cours, en DA <span className="opt-tag">(facultatif)</span></label>
            <input id={`${uid}-price`} className="input" type="number" min={0} inputMode="numeric" value={n.price} onChange={setName("price")} placeholder="2000" />
          </div>
          <p className="hint">Un cours ponctuel se paie à lui seul : 1 cours = 1 paiement, à ce prix. Il n'est pas ajouté chaque semaine.</p>
        </fieldset>
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
