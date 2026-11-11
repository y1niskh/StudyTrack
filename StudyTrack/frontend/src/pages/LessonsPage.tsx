import { useCallback, useEffect, useState, type CSSProperties } from "react";
import FridgeFrame from "../components/FridgeFrame";
import Header from "../components/Header";
import LessonForm, { type LessonValues } from "../components/LessonForm";
import SlotForm from "../components/SlotForm";
import { addDays, startOfDay, studentColor, weekRange } from "../lib/cycles";
import { dayKey, STATUS_LABEL, timeOf, toISO } from "../lib/lessons";
import { isVirtual, occurrences, WEEKDAYS } from "../lib/slots";
import { createLesson, createSlot, deleteLesson, deleteSlot, fetchDashboard, updateLesson } from "../services/api";
import { ApiError } from "../services/auth";
import type { DashboardData, Lesson, LessonStatus } from "../types";
import "./LessonsPage.css";

const fmt = (d: Date | string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", o).format(new Date(d));
const cap = (t: string) => t[0].toUpperCase() + t.slice(1);

export default function LessonsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [offset, setOffset] = useState(0); // 0 = cette semaine
  const [student, setStudent] = useState("all");
  const [editId, setEditId] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [stopId, setStopId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [now] = useState(() => new Date());

  const load = useCallback(async () => {
    try { const d = await fetchDashboard(); setData(d); setError(""); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Impossible de charger les données."); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function run(job: () => Promise<unknown>, ok: string) {
    setBusy(true); setError(""); setNotice("");
    try { await job(); setNotice(ok); await load(); return true; }
    catch (e) { setError(e instanceof ApiError ? e.message : "L'opération a échoué. Réessaie."); return false; }
    finally { setBusy(false); }
  }

  const enrollments = data?.enrollments ?? [];
  const slots = data?.slots ?? [];
  const color = studentColor(enrollments);
  const byId = new Map(enrollments.map((e) => [e.id, e]));
  const locked = new Set((data?.cycles ?? []).filter((c) => c.status === "paid").flatMap((c) => c.lessonIds));
  const students = [...new Set(enrollments.map((e) => e.studentName))].sort();

  /* Semaine affichée : du dimanche au samedi, comme pour les paiements */
  const weekStart = addDays(weekRange(now).start, 7 * offset);
  const weekEnd = addDays(weekStart, 7);
  const last = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === last.getMonth();
  const weekLabel = `du ${fmt(weekStart, sameMonth ? { weekday: "long", day: "numeric" } : { weekday: "long", day: "numeric", month: "long" })} au ${fmt(last, { weekday: "long", day: "numeric", month: "long" })}`;

  const known = (l: Lesson) => byId.has(l.enrollmentId);
  const inWeek = !data ? [] : [...data.lessons, ...occurrences(slots, data.lessons, weekStart, weekEnd)]
    .filter((l) => known(l) && new Date(l.date) >= weekStart && new Date(l.date) < weekEnd && (student === "all" || byId.get(l.enrollmentId)!.studentName === student))
    .sort((a, b) => a.date.localeCompare(b.date));

  /* Cours prévus dont l'heure est passée : à confirmer (fait ou annulé) pour que les paiements restent justes */
  const since = slots.length ? new Date(`${slots.map((s) => s.since).sort()[0]}T00:00`) : now;
  const toConfirm = !data ? [] : [...data.lessons, ...occurrences(slots, data.lessons, since, now)]
    .filter((l) => known(l) && l.status === "planned" && new Date(l.date) < now)
    .sort((a, b) => a.date.localeCompare(b.date));

  const toValues = (l: Lesson): LessonValues => ({ enrollmentId: l.enrollmentId, date: dayKey(l.date), time: timeOf(l.date), status: l.status, notes: l.notes ?? "" });
  const body = (v: LessonValues) => ({ date: toISO(v.date, v.time), status: v.status as LessonStatus, notes: v.notes.trim() || undefined });
  const save = (l: Lesson, patch: Partial<Lesson>) => isVirtual(l.id)
    ? createLesson({ enrollmentId: l.enrollmentId, date: l.date, status: l.status, notes: l.notes, slotId: l.slotId, occurrence: l.occurrence, ...patch })
    : updateLesson(l.id, patch);
  const blank: LessonValues = { enrollmentId: "", date: dayKey(now), time: "16:00", status: "planned", notes: "" };
  const today = dayKey(startOfDay(now)), tomorrow = dayKey(addDays(startOfDay(now), 1));

  const row = (l: Lesson) => {
    const e = byId.get(l.enrollmentId)!;
    return (
      <li key={l.id} className={`lrow ${l.status}`} style={{ "--c": color(e.studentName) } as CSSProperties}>
        <i className="gom" aria-hidden="true" />
        {editId === l.id ? (
          <>
            <p className="stu">{e.studentName}</p>
            <p className="l2">{e.subjectName} avec {e.teacherName}</p>
            <LessonForm initial={toValues(l)} submitLabel="Enregistrer" busy={busy} onCancel={() => { setEditId(null); setDelId(null); }}
              onSubmit={async (v) => { if (await run(() => save(l, body(v)), "Cours modifié.")) setEditId(null); }}
              extra={isVirtual(l.id) ? null : delId === l.id ? (
                <div className="confirm" role="group" aria-label="Confirmer la suppression">
                  <p>Supprimer ce cours ?</p>
                  <button type="button" className="primary danger" disabled={busy} onClick={async () => { if (await run(() => deleteLesson(l.id), "Cours supprimé.")) { setEditId(null); setDelId(null); } }}>Oui, supprimer</button>
                  <button type="button" className="ghost" onClick={() => setDelId(null)}>Non</button>
                </div>
              ) : <button type="button" className="ghost" onClick={() => setDelId(l.id)}>Supprimer</button>} />
          </>
        ) : (
          <>
            <div className="l1"><span className="time">{timeOf(l.date)}</span><strong className="stu">{e.studentName}</strong><span className={`stamp ${l.status}`}>{STATUS_LABEL[l.status]}</span></div>
            <p className="l2">{e.subjectName} avec {e.teacherName}</p>
            {l.notes && <p className="note">« {l.notes} »</p>}
            {locked.has(l.id)
              ? <p className="lock"><svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3" /></svg> Dans un cycle déjà payé : ne peut plus être modifié.</p>
              : <button className="ghost small" onClick={() => { setEditId(l.id); setDelId(null); setNotice(""); }}>Modifier</button>}
          </>
        )}
      </li>
    );
  };

  const setup = data && (
    <div className="setup">
      <section className="sheet slots" aria-labelledby="h-slots">
        <i className="magnet" style={{ "--m": "#2f7de1" } as CSSProperties} aria-hidden="true" />
        <h2 id="h-slots">{slots.length === 0 ? "Comment ça marche" : "Mes cours chaque semaine"}</h2>
        {slots.length === 0 && (
          <ol className="steps">
            <li><b>1</b> Écris le cours une seule fois : élève, matière, enseignant, jour et heure.</li>
            <li><b>2</b> Il s'affiche tout seul chaque semaine, à la bonne date.</li>
            <li><b>3</b> Après le cours, appuie sur « Oui, il a eu lieu ». Les paiements se calculent tout seuls.</li>
          </ol>
        )}
        <ul>
          {[...slots].sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time)).map((s) => {
            const e = byId.get(s.enrollmentId); if (!e) return null;
            return (
              <li key={s.id} className="item" style={{ "--c": color(e.studentName) } as CSSProperties}>
                <p className="stu">{e.studentName}</p>
                <p className="l2">{e.subjectName} avec {e.teacherName}</p>
                <p className="every">Chaque {WEEKDAYS[s.weekday]} à {s.time}</p>
                {stopId === s.id ? (
                  <div className="confirm" role="group" aria-label="Confirmer l'arrêt">
                    <p>Arrêter ce cours ? Les cours déjà passés sont gardés.</p>
                    <button className="primary danger" disabled={busy} onClick={async () => { if (await run(() => deleteSlot(s.id), "Ce cours ne se répète plus.")) setStopId(null); }}>Oui, arrêter</button>
                    <button className="ghost" onClick={() => setStopId(null)}>Non</button>
                  </div>
                ) : <button className="ghost small" onClick={() => setStopId(s.id)}>Arrêter ce cours</button>}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="sheet add" aria-labelledby="h-add">
        <i className="magnet" aria-hidden="true" />
        <h2 id="h-add">Ajouter un cours</h2>
        <p className="sub">Écris-le une seule fois : il s'affichera tout seul chaque semaine.</p>
        <SlotForm key={`s${formKey}`} students={students} subjects={[...new Set(enrollments.map((e) => e.subjectName))].sort()}
          teachers={[...new Set(enrollments.map((e) => e.teacherName))].sort()} busy={busy}
          onSubmit={async (v) => { if (await run(() => createSlot(v), "Cours ajouté : il apparaît chaque semaine.")) setFormKey((k) => k + 1); }} />
        {enrollments.length > 0 && (
          <details className="oneoff">
            <summary>Ajouter un seul cours (rattrapage)</summary>
            <LessonForm key={`l${formKey}`} enrollments={enrollments} initial={blank} submitLabel="Ajouter ce cours" busy={busy}
              onSubmit={async (v) => { if (await run(() => createLesson({ enrollmentId: v.enrollmentId, ...body(v) }), "Cours ajouté.")) setFormKey((k) => k + 1); }} />
          </details>
        )}
      </section>
    </div>
  );

  return (
    <main className="fridge fridge--board">
      <FridgeFrame />
      <div className="board">
        <Header />
        {error && <p className="form-error" role="alert">{error}</p>}
        {!data && !error && <p className="loading" role="status">Chargement…</p>}
        {notice && <p className="notice" role="status">{notice}</p>}

        {data && (
          <>
            {slots.length === 0 && setup}

            {toConfirm.length > 0 && (
              <section className="sheet confirmbox" aria-labelledby="h-conf">
                <i className="magnet big" style={{ "--m": "#e8590c" } as CSSProperties} aria-hidden="true" />
                <h2 id="h-conf">À confirmer</h2>
                <p className="sub">Ces cours ont-ils eu lieu ?</p>
                <ul className="cgrid">
                  {toConfirm.map((l) => { const e = byId.get(l.enrollmentId)!; return (
                    <li key={l.id} className="item" style={{ "--c": color(e.studentName) } as CSSProperties}>
                      <p className="stu">{e.studentName}</p>
                      <p className="l2">{e.subjectName} avec {e.teacherName}</p>
                      <p className="every">{cap(fmt(l.date, { weekday: "long", day: "numeric", month: "long" }))} à {timeOf(l.date)}</p>
                      <div className="yn">
                        <button className="primary ok" disabled={busy} onClick={() => void run(() => save(l, { status: "completed" }), "Cours confirmé.")}>Oui, il a eu lieu</button>
                        <button className="ghost" disabled={busy} onClick={() => void run(() => save(l, { status: "cancelled" }), "Cours marqué annulé.")}>Annulé</button>
                      </div>
                    </li>); })}
                </ul>
              </section>
            )}

            <section className="fiche" aria-labelledby="h-week">
              <i className="magnet big" aria-hidden="true" />
              <h2 id="h-week">Mes cours de la semaine</h2>
              {slots.length === 0 && data.lessons.length === 0 ? (
                <p className="empty">Ton emploi du temps apparaîtra ici dès que tu auras ajouté un cours.</p>
              ) : (<>
              <div className="weeknav">
                <button className="ghost" onClick={() => setOffset(offset - 1)} aria-label="Semaine précédente">‹ Avant</button>
                <p className="sub" aria-live="polite">{weekLabel}</p>
                <button className="ghost" onClick={() => setOffset(offset + 1)} aria-label="Semaine suivante">Après ›</button>
                {offset !== 0 && <button className="ghost" onClick={() => setOffset(0)}>Cette semaine</button>}
              </div>
              {students.length > 1 && (
                <div className="chips" role="group" aria-label="Élève">
                  {["all", ...students].map((s) => (
                    <button key={s} type="button" className={`chip${student === s ? " on" : ""}`} aria-pressed={student === s} onClick={() => setStudent(s)}>
                      {s !== "all" && <i className="dotc" style={{ background: color(s) }} />}{s === "all" ? "Tous les élèves" : s}
                    </button>
                  ))}
                </div>
              )}
              {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d) => {
                const k = dayKey(d); const list = inWeek.filter((l) => dayKey(l.date) === k);
                return (
                  <section key={k} className="dayblock" aria-label={fmt(d, { dateStyle: "long" })}>
                    <h3 className="day">{fmt(d, { weekday: "long", day: "numeric", month: "long" })}{k === today && <span className="tag">Aujourd'hui</span>}{k === tomorrow && <span className="tag">Demain</span>}</h3>
                    {list.length === 0 ? <p className="nolesson">Pas de cours</p> : <ul>{list.map(row)}</ul>}
                  </section>
                );
              })}
              </>)}
            </section>

            {slots.length > 0 && setup}
          </>
        )}
      </div>
    </main>
  );
}
