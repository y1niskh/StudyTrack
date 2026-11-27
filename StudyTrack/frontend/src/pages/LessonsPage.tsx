import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import Icon from "../components/Icon";
import LessonForm, { type LessonValues } from "../components/LessonForm";
import { Confirm, Modal } from "../components/Modal";
import SlotForm from "../components/SlotForm";
import { Avatar, Badge, Empty, LessonBadge, Notice, PageHeader, PageMessages } from "../components/ui";
import { addDays, studentColor, weekRange } from "../lib/cycles";
import { dayKey, timeOf, toISO } from "../lib/lessons";
import { isVirtual, lessonsToConfirm, occurrences, slotsSentence, WEEKDAYS } from "../lib/slots";
import { cap, fmt, useAppData } from "../lib/useAppData";
import { createLesson, createOneOffLesson, createSlots, deleteLesson, moveSlot, stopSlot, updateLesson } from "../services/api";
import SlotMoveForm from "../components/SlotMoveForm";
import type { Lesson, LessonStatus, Slot } from "../types";
import "./LessonsPage.css";

type Patch = Partial<Pick<Lesson, "date" | "status" | "notes">>;
type Dialog = { kind: "slot" } | { kind: "one" } | { kind: "edit"; lesson: Lesson; confirmDelete: boolean } | { kind: "stop"; slot: Slot } | { kind: "move"; slot: Slot } | null;

export default function LessonsPage() {
  const { data, error, notice, busy, load, run, clearNotice, clearError } = useAppData();
  const [offset, setOffset] = useState(0); // 0 = cette semaine, -1 = la semaine passée, 1 = la suivante…
  const [params] = useSearchParams();
  const [studentChoice, setStudent] = useState(() => params.get("eleve") ?? "all");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [now] = useState(() => new Date());

  const enrollments = data?.enrollments ?? [];
  const slots = data?.slots ?? [];
  const color = studentColor(enrollments);
  const byId = new Map(enrollments.map((e) => [e.id, e]));
  const locked = new Set((data?.cycles ?? []).filter((c) => c.status === "paid").flatMap((c) => c.lessonIds));
  const uniq = (f: (e: (typeof enrollments)[number]) => string) => [...new Set(enrollments.map(f))].sort();
  const students = uniq((e) => e.studentName);
  const student = students.includes(studentChoice) ? studentChoice : "all";

  /* Semaine affichée : cours enregistrés + cours qui se répètent (calculés), du dimanche au samedi */
  const weekStart = addDays(weekRange(now).start, 7 * offset);
  const weekEnd = addDays(weekStart, 7);
  const pool = data ? [...data.lessons, ...occurrences(slots, data.lessons, weekStart, weekEnd)] : [];
  const okStudent = (l: Lesson) => { const e = byId.get(l.enrollmentId); return !!e && (student === "all" || e.studentName === student); };
  const inWeek = pool.filter((l) => new Date(l.date) >= weekStart && new Date(l.date) < weekEnd && okStudent(l)).sort((a, b) => a.date.localeCompare(b.date));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const last = addDays(weekStart, 6);
  const weekLabel = `Du ${fmt(weekStart, weekStart.getMonth() === last.getMonth() ? { weekday: "long", day: "numeric" } : { weekday: "long", day: "numeric", month: "long" })} au ${fmt(last, { weekday: "long", day: "numeric", month: "long" })}`;
  const weekTitle = offset === 0 ? "Cette semaine" : offset === 1 ? "La semaine prochaine" : offset === -1 ? "La semaine passée" : offset > 0 ? `Dans ${offset} semaines` : `Il y a ${-offset} semaines`;

  /* À confirmer : cours prévus dont l'heure est passée et qu'on n'a pas encore marqués « fait » ou « annulé » */
  const toConfirm = data ? lessonsToConfirm(data, now) : [];

  const toValues = (l: Lesson): LessonValues => ({ enrollmentId: l.enrollmentId, date: dayKey(l.date), time: timeOf(l.date), status: l.status, notes: l.notes ?? "" });
  const body = (v: LessonValues) => ({ date: toISO(v.date, v.time), status: v.status as LessonStatus, notes: v.notes.trim() || undefined });
  const blank: LessonValues = { enrollmentId: "", date: dayKey(now), time: "16:00", status: "planned", notes: "" };
  /* Un cours « virtuel » (calculé à partir d'un cours de chaque semaine) est enregistré au moment où on agit dessus ; un vrai cours est simplement modifié */
  const save = (l: Lesson, patch: Patch) =>
    isVirtual(l.id)
      ? createLesson({ enrollmentId: l.enrollmentId, date: l.date, status: l.status, notes: l.notes, slotId: l.slotId, occurrence: l.occurrence, ...patch })
      : updateLesson(l.id, patch);
  const close = () => { setDialog(null); clearError(); };
  const act = async (job: () => Promise<unknown>, ok: string) => { if (await run(job, ok)) setDialog(null); };
  const modalError = error && dialog ? <Notice kind="error">{error}</Notice> : null;
  /* Les cours passés pas encore confirmés de ce cours chaque semaine (calculés, pas encore enregistrés) */
  const pendingOf = (s: Slot) => toConfirm.filter((l) => isVirtual(l.id) && l.slotId === s.id);

  const person = (l: Lesson) => {
    const e = byId.get(l.enrollmentId)!;
    return (
      <div className="row-main">
        <Avatar name={e.studentName} color={color(e.studentName)} />
        <div className="row-text"><p className="row-title">{e.studentName}</p><p className="row-sub">{e.subjectName} avec {e.teacherName}</p></div>
      </div>
    );
  };

  const editing = dialog?.kind === "edit" ? dialog.lesson : null;
  const editingEnr = editing ? byId.get(editing.enrollmentId) : undefined;

  return (
    <AppLayout>
      <div className="page">
        <PageHeader title="Planning des cours" sub="Les cours de la semaine, jour par jour.">
          {data && <button type="button" className="btn btn-primary" onClick={() => { clearNotice(); setDialog({ kind: "slot" }); }}><Icon n="plus" /> Ajouter un cours</button>}
          {data && <button type="button" className="btn btn-secondary" onClick={() => { clearNotice(); setDialog({ kind: "one" }); }}>Ajouter un cours ponctuel</button>}
        </PageHeader>

        <PageMessages loaded={!!data} error={dialog ? "" : error} notice={notice} onRetry={() => void load()} onCloseError={clearError} onCloseNotice={clearNotice} />

        {data && (
          <>
            {slots.length === 0 && (
              <section className="card card-pad" aria-labelledby="h-start">
                <h2 id="h-start" className="section-title">Pour commencer</h2>
                <ol className="steps">
                  <li><b>1</b><span>Appuie sur <strong>« Ajouter un cours »</strong> et écris-le une seule fois : l'élève, la matière, l'enseignant, le jour et l'heure.</span></li>
                  <li><b>2</b><span>Le cours s'affiche ensuite <strong>tout seul chaque semaine</strong>, ici et sur l'accueil.</span></li>
                  <li><b>3</b><span>Après chaque cours, indique s'il a eu lieu : <strong>le paiement se calcule tout seul</strong>.</span></li>
                </ol>
              </section>
            )}

            {toConfirm.length > 0 && (
              <section className="card card-warn" aria-labelledby="h-conf">
                <div className="card-head"><h2 id="h-conf">Cours à confirmer</h2><Badge tone="warning">{toConfirm.length} à confirmer</Badge><p className="card-sub">Ces cours sont passés. Ont-ils eu lieu ?</p></div>
                <ul className="rows">
                  {toConfirm.map((l) => (
                    <li key={l.id} className="row">
                      {person(l)}
                      <p className="row-when"><Icon n="clock" /> {cap(fmt(l.date, { weekday: "long", day: "numeric", month: "long" }))} à {timeOf(l.date)}</p>
                      <div className="row-actions">
                        <button type="button" className="btn btn-success btn-sm" disabled={busy} onClick={() => void run(() => save(l, { status: "completed" }), "Cours confirmé : il compte pour le paiement.")}><Icon n="check" /> Oui, il a eu lieu</button>
                        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void run(() => save(l, { status: "cancelled" }), "Cours marqué comme annulé : il ne compte pas pour le paiement.")}>Non, il n'a pas eu lieu</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="card" aria-labelledby="h-week">
              <div className="card-head week-head">
                <div><h2 id="h-week">{weekTitle}</h2><p className="muted">{weekLabel}</p></div>
                <div className="weeknav">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOffset(offset - 1)}><Icon n="left" /> Semaine précédente</button>
                  {offset !== 0 && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOffset(0)}>Revenir à cette semaine</button>}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOffset(offset + 1)}>Semaine suivante <Icon n="right" /></button>
                </div>
              </div>
              {students.length > 1 && (
                <div className="filter" role="group" aria-label="Afficher les cours de">
                  <span className="filter-label" aria-hidden="true">Afficher :</span>
                  {["all", ...students].map((s) => (
                    <button key={s} type="button" className="pill" aria-pressed={student === s} onClick={() => setStudent(s)}>
                      {s !== "all" && <i className="dot" style={{ "--c": color(s) } as React.CSSProperties} />}{s === "all" ? "Tous les élèves" : s}
                    </button>
                  ))}
                </div>
              )}
              {slots.length === 0 && inWeek.length === 0 ? <Empty icon="calendar" title="Aucun cours cette semaine">Ajoute d'abord un cours avec le bouton « Ajouter un cours ».</Empty> : (
                <div className="days">
                  {days.map((d) => {
                    const k = dayKey(d); const list = inWeek.filter((l) => dayKey(l.date) === k);
                    const tag = k === dayKey(now) ? "Aujourd'hui" : k === dayKey(addDays(now, 1)) ? "Demain" : "";
                    return (
                      <section key={k} className={`day${list.length === 0 ? " day-empty" : ""}${tag === "Aujourd'hui" ? " day-today" : ""}`} aria-label={fmt(d, { dateStyle: "full" })}>
                        <h3 className="day-title">{cap(fmt(d, { weekday: "long", day: "numeric", month: "long" }))}{tag && <Badge tone="info">{tag}</Badge>}</h3>
                        {list.length === 0 ? <p className="muted">Pas de cours</p> : (
                          <ul className="rows lesson-list">
                            {list.map((l) => (
                              <li key={l.id} className={`row lesson${l.status === "cancelled" ? " is-cancelled" : ""}`}>
                                <span className="time">{timeOf(l.date)}</span>
                                {person(l)}
                                <LessonBadge status={l.status} />
                                {l.notes && <p className="row-note">Remarque : {l.notes}</p>}
                                {locked.has(l.id)
                                  ? <p className="row-note lock"><Icon n="lock" /> Ce cours fait partie d'un paiement déjà réglé, il ne peut plus être modifié. En cas d'erreur : page Paiements, « Corriger ce paiement », puis modifie le cours et paie de nouveau.</p>
                                  : <div className="row-actions"><button type="button" className="btn btn-secondary btn-sm" onClick={() => { clearNotice(); setDialog({ kind: "edit", lesson: l, confirmDelete: false }); }}><Icon n="edit" /> Modifier</button></div>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </section>

            {slots.length > 0 && (
              <section className="card" aria-labelledby="h-slots">
                <div className="card-head"><h2 id="h-slots">Cours chaque semaine</h2><p className="card-sub">Ces cours s'affichent tout seuls dans le planning, chaque semaine.</p></div>
                <ul className="rows">
                  {[...slots].sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time)).map((s) => {
                    const e = byId.get(s.enrollmentId); if (!e) return null;
                    return (
                      <li key={s.id} className="row">
                        <div className="row-main">
                          <Avatar name={e.studentName} color={color(e.studentName)} />
                          <div className="row-text"><p className="row-title">{e.studentName}</p><p className="row-sub">{e.subjectName} avec {e.teacherName}</p></div>
                        </div>
                        <p className="row-when"><Icon n="repeat" /> Chaque {WEEKDAYS[s.weekday]} à {s.time}</p>
                        <div className="row-actions">
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { clearNotice(); setDialog({ kind: "move", slot: s }); }}><Icon n="edit" /> Modifier le jour ou l'heure</button>
                          <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => { clearNotice(); setDialog({ kind: "stop", slot: s }); }}>Arrêter ce cours</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </>
        )}
      </div>

      <Modal open={dialog?.kind === "slot"} title="Ajouter un cours chaque semaine" onClose={close}>
        <p className="modal-intro">Écris le cours une seule fois : il s'affichera tout seul chaque semaine. Coche plusieurs jours s'il a lieu plusieurs fois par semaine. Un nouvel élève est ajouté automatiquement.</p>
        {modalError}
        <SlotForm students={students} subjects={uniq((e) => e.subjectName)} teachers={uniq((e) => e.teacherName)} busy={busy} onCancel={close}
          submitLabel="Ajouter ce cours" onSubmit={(list) => void act(() => createSlots(list), `Cours ajouté : ${list[0].studentName}, ${slotsSentence(list)}.`)} />
      </Modal>

      <Modal open={dialog?.kind === "one"} title="Ajouter un cours ponctuel" onClose={close}>
        <p className="modal-intro">Pour un cours qui n'a lieu qu'une fois : un rattrapage, ou un cours avec un enseignant quand l'élève en a besoin.</p>
        {modalError}
        <LessonForm enrollments={enrollments} names={{ students, subjects: uniq((e) => e.subjectName), teachers: uniq((e) => e.teacherName) }} initial={blank} submitLabel="Ajouter ce cours" busy={busy} onCancel={close}
          onSubmit={(v) => void act(() => createOneOffLesson(v.newCourse ? { newCourse: v.newCourse } : { enrollmentId: v.enrollmentId }, body(v)), "Cours ponctuel ajouté au planning.")} />
      </Modal>

      <Modal open={!!editing} title="Modifier le cours" onClose={close}>
        {editing && editingEnr && (dialog?.kind === "edit" && dialog.confirmDelete ? (
          <>
            {modalError}
            <div className="modal-text">
              <p>Supprimer le cours de <strong>{editingEnr.studentName}</strong> ({editingEnr.subjectName}) du {fmt(editing.date, { weekday: "long", day: "numeric", month: "long" })} à {timeOf(editing.date)} ?</p>
              <p className="muted">Cette action est définitive.</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setDialog({ kind: "edit", lesson: editing, confirmDelete: false })}>Non, garder ce cours</button>
              <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void act(() => deleteLesson(editing.id), "Cours supprimé.")}>{busy ? "Un instant…" : "Oui, supprimer ce cours"}</button>
            </div>
          </>
        ) : (
          <>
            <p className="modal-intro"><strong>{editingEnr.studentName}</strong> · {editingEnr.subjectName} avec {editingEnr.teacherName}</p>
            {modalError}
            <LessonForm initial={toValues(editing)} submitLabel="Enregistrer les modifications" busy={busy} onCancel={close}
              onSubmit={(v) => void act(() => save(editing, body(v)), "Cours modifié.")}
              extra={isVirtual(editing.id) ? null : (
                <div className="danger-zone">
                  <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => { clearError(); setDialog({ kind: "edit", lesson: editing, confirmDelete: true }); }}><Icon n="trash" /> Supprimer ce cours</button>
                </div>
              )} />
          </>
        ))}
      </Modal>

      {dialog?.kind === "move" && (() => {
        const s = dialog.slot; const e = byId.get(s.enrollmentId);
        return (
          <Modal open title="Modifier le jour ou l'heure" onClose={close}>
            {e && <p className="modal-intro"><strong>{e.studentName}</strong> · {e.subjectName} avec {e.teacherName}. Aujourd'hui : chaque {WEEKDAYS[s.weekday]} à {s.time}.</p>}
            {modalError}
            {e && <SlotMoveForm slot={s} busy={busy} onCancel={close}
              onSubmit={(to) => void act(() => moveSlot(s, e, to, pendingOf(s)), `Cours modifié : ${e.studentName}, maintenant chaque ${WEEKDAYS[to.weekday]} à ${to.time}.`)} />}
          </Modal>
        );
      })()}

      {dialog?.kind === "stop" && (() => {
        const e = byId.get(dialog.slot.enrollmentId);
        return (
          <Confirm open title="Arrêter ce cours ?" confirmLabel="Oui, arrêter ce cours" tone="danger" busy={busy} onCancel={close}
            onConfirm={() => void act(() => stopSlot(dialog.slot.id, pendingOf(dialog.slot)), "Ce cours ne se répète plus. Les cours passés sont gardés.")}>
            {modalError}
            <p>Le cours de <strong>{e?.studentName}</strong> ({e?.subjectName}) du {WEEKDAYS[dialog.slot.weekday]} à {dialog.slot.time} ne s'affichera plus les semaines suivantes.</p>
            <p className="muted">Les cours déjà passés et les paiements sont gardés.</p>
          </Confirm>
        );
      })()}
    </AppLayout>
  );
}
