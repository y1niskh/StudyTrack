import { useCallback, useEffect, useState, type CSSProperties } from "react";
import FridgeFrame from "../components/FridgeFrame";
import Header from "../components/Header";
import LessonForm, { type LessonValues } from "../components/LessonForm";
import SlotForm from "../components/SlotForm";
import { addDays, studentColor, weekRange } from "../lib/cycles";
import { dayKey, STATUS_LABEL, timeOf, toISO } from "../lib/lessons";
import { isVirtual, occurrences, WEEKDAYS } from "../lib/slots";
import { createLesson, createSlot, deleteLesson, deleteSlot, fetchDashboard, updateLesson } from "../services/api";
import { ApiError } from "../services/auth";
import type { DashboardData, Lesson, LessonStatus } from "../types";
import "./LessonsPage.css";

const fmt = (d: Date | string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", o).format(new Date(d));

export default function LessonsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [offset, setOffset] = useState(0); // 0 = cette semaine, -1 = la semaine passée, 1 = la suivante…
  const [student, setStudent] = useState("all");
  const [editId, setEditId] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [stopId, setStopId] = useState<string | null>(null);
  const [addKey, setAddKey] = useState(0);
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
  const uniq = (f: (e: (typeof enrollments)[number]) => string) => [...new Set(enrollments.map(f))].sort();
  const students = uniq((e) => e.studentName);

  /* Semaine affichée : cours enregistrés + cours qui se répètent (calculés), du dimanche au samedi */
  const weekStart = addDays(weekRange(now).start, 7 * offset);
  const weekEnd = addDays(weekStart, 7);
  const pool = data ? [...data.lessons, ...occurrences(slots, data.lessons, weekStart, weekEnd)] : [];
  const okStudent = (l: Lesson) => { const e = byId.get(l.enrollmentId); return !!e && (student === "all" || e.studentName === student); };
  const inWeek = pool.filter((l) => new Date(l.date) >= weekStart && new Date(l.date) < weekEnd && okStudent(l)).sort((a, b) => a.date.localeCompare(b.date));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekLabel = (() => {
    const last = addDays(weekStart, 6); const same = weekStart.getMonth() === last.getMonth();
    return `du ${fmt(weekStart, same ? { weekday: "long", day: "numeric" } : { weekday: "long", day: "numeric", month: "long" })} au ${fmt(last, { weekday: "long", day: "numeric", month: "long" })}`;
  })();

  /* À confirmer : cours prévus dont l'heure est passée et qu'on n'a pas encore marqués « fait » ou « annulé » */
  const since = slots.map((s) => new Date(`${s.since}T00:00`)).sort((a, b) => +a - +b)[0] ?? now;
  const toConfirm = data
    ? [...data.lessons, ...occurrences(slots, data.lessons, since, now)].filter((l) => l.status === "planned" && new Date(l.date) < now && byId.has(l.enrollmentId)).sort((a, b) => a.date.localeCompare(b.date))
    : [];

  const toValues = (l: Lesson): LessonValues => ({ enrollmentId: l.enrollmentId, date: dayKey(l.date), time: timeOf(l.date), status: l.status, notes: l.notes ?? "" });
  const body = (v: LessonValues) => ({ date: toISO(v.date, v.time), status: v.status as LessonStatus, notes: v.notes.trim() || undefined });
  const blank: LessonValues = { enrollmentId: "", date: dayKey(now), time: "16:00", status: "planned", notes: "" };
  /* Un cours « virtuel » est enregistré au moment où on agit dessus ; un vrai cours est simplement modifié */
  const save = (l: Lesson, patch: Partial<LessonInput2>) =>
    isVirtual(l.id)
      ? createLesson({ enrollmentId: l.enrollmentId, date: l.date, status: l.status, notes: l.notes, slotId: l.slotId, occurrence: l.occurrence, ...patch })
      : updateLesson(l.id, patch);

  const info = (l: Lesson) => { const e = byId.get(l.enrollmentId)!; return <p className="l2">{e.subjectName} avec {e.teacherName}</p>; };

  const row = (l: Lesson) => {
    const e = byId.get(l.enrollmentId)!;
    const virt = isVirtual(l.id);
    return (
      <li key={l.id} className={`lrow ${l.status}`} style={{ "--c": color(e.studentName) } as CSSProperties}>
        <i className="gom" aria-hidden="true" />
        {editId === l.id ? (
          <>
            <p className="stu">{e.studentName}</p>
            {info(l)}
            <LessonForm initial={toValues(l)} submitLabel="Enregistrer" busy={busy} onCancel={() => { setEditId(null); setDelId(null); }}
              onSubmit={async (v) => { if (await run(() => save(l, body(v)), "Cours modifié.")) setEditId(null); }}
              extra={virt ? null : delId === l.id ? (
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
            {info(l)}
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
        <h2 id="h-slots">Mes cours chaque semaine</h2>
        {slots.length === 0 && (
          <ol className="steps">
            <li><b>1</b><span>Écris un cours <strong>une seule fois</strong> avec le papier jaune : l'élève, la matière, l'enseignant, le jour et l'heure.</span></li>
            <li><b>2</b><span>Il s'affiche <strong>tout seul chaque semaine</strong>, ici et sur l'accueil (les cours de demain).</span></li>
            <li><b>3</b><span>Après chaque cours, dis s'il a eu lieu : <strong>le paiement se calcule tout seul</strong>.</span></li>
          </ol>
        )}
        <ul>
          {[...slots].sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time)).map((s) => {
            const e = byId.get(s.enrollmentId); if (!e) return null;
            return (
              <li key={s.id} className="item" style={{ "--c": color(e.studentName) } as CSSProperties}>
                <p className="stu">{e.studentName}</p>
                <p className="l2">{e.subjectName} avec {e.teacherName}</p>
                <p className="when">Chaque {WEEKDAYS[s.weekday]} à {s.time}</p>
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
        <SlotForm key={addKey} students={students} subjects={uniq((e) => e.subjectName)} teachers={uniq((e) => e.teacherName)} busy={busy}
          onSubmit={async (v) => { if (await run(() => createSlot(v), "Cours ajouté : il apparaît chaque semaine.")) setAddKey((k) => k + 1); }} />
        {enrollments.length > 0 && (
          <details className="oneoff">
            <summary>Ajouter un seul cours (rattrapage)</summary>
            <LessonForm enrollments={enrollments} initial={blank} submitLabel="Ajouter ce cours" busy={busy}
              onSubmit={async (v) => { await run(() => createLesson({ enrollmentId: v.enrollmentId, ...body(v) }), "Cours ajouté."); }} />
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
                <i className="magnet" style={{ "--m": "#d62f4b" } as CSSProperties} aria-hidden="true" />
                <h2 id="h-conf">À confirmer</h2>
                <p className="sub">Ces cours ont-ils eu lieu ?</p>
                <ul className="cgrid">
                  {toConfirm.map((l) => {
                    const e = byId.get(l.enrollmentId)!;
                    return (
                      <li key={l.id} className="item" style={{ "--c": color(e.studentName) } as CSSProperties}>
                        <p className="stu">{e.studentName}</p>
                        <p className="l2">{e.subjectName} avec {e.teacherName}</p>
                        <p className="when">{fmt(l.date, { weekday: "long", day: "numeric", month: "long" })} à {timeOf(l.date)}</p>
                        <div className="yesno">
                          <button className="primary ok" disabled={busy} onClick={() => void run(() => save(l, { status: "completed" }), "Cours confirmé.")}>Oui, il a eu lieu</button>
                          <button className="ghost" disabled={busy} onClick={() => void run(() => save(l, { status: "cancelled" }), "Cours annulé.")}>Il n'a pas eu lieu</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <section className="fiche" aria-labelledby="h-week">
              <i className="magnet big" aria-hidden="true" />
              <h2 id="h-week">{offset === 0 ? "Cette semaine" : offset === 1 ? "La semaine prochaine" : offset === -1 ? "La semaine passée" : "Une autre semaine"}</h2>
              <p className="sub">{weekLabel}</p>
              <div className="weeknav">
                <button className="ghost" onClick={() => setOffset(offset - 1)}>‹ Semaine précédente</button>
                {offset !== 0 && <button className="ghost" onClick={() => setOffset(0)}>Cette semaine</button>}
                <button className="ghost" onClick={() => setOffset(offset + 1)}>Semaine suivante ›</button>
              </div>
              {students.length > 1 && (
                <fieldset className="chips">
                  <legend>Élève</legend>
                  <div>
                    {["all", ...students].map((s) => (
                      <button key={s} type="button" className={`chip${student === s ? " on" : ""}`} aria-pressed={student === s} onClick={() => setStudent(s)}>
                        {s !== "all" && <i className="dotc" style={{ background: color(s) }} />}{s === "all" ? "Tous" : s}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
              {slots.length === 0 && inWeek.length === 0 && <p className="none">Rien à afficher : ajoute d'abord un cours.</p>}
              {(slots.length > 0 || inWeek.length > 0) && days.map((d) => {
                const k = dayKey(d); const list = inWeek.filter((l) => dayKey(l.date) === k);
                const tag = k === dayKey(now) ? "Aujourd'hui" : k === dayKey(addDays(now, 1)) ? "Demain" : "";
                return (
                  <section key={k} className="dayblock" aria-label={fmt(d, { dateStyle: "long" })}>
                    <h3 className="day">{fmt(d, { weekday: "long", day: "numeric", month: "long" })}{tag && <span className="tag">{tag}</span>}</h3>
                    {list.length === 0 ? <p className="nolesson">Pas de cours</p> : <ul>{list.map(row)}</ul>}
                  </section>
                );
              })}
            </section>

            {slots.length > 0 && setup}
          </>
        )}
      </div>
    </main>
  );
}

type LessonInput2 = Partial<Pick<Lesson, "date" | "status" | "notes">>;
