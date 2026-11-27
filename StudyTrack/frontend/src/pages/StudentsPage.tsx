import { useId, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import EnrollmentForm from "../components/EnrollmentForm";
import Icon from "../components/Icon";
import { Modal } from "../components/Modal";
import PaymentItem from "../components/PaymentItem";
import SlotForm from "../components/SlotForm";
import { Avatar, Badge, Empty, Notice, PageHeader, PageMessages } from "../components/ui";
import { activeEnrollmentIds, isOverdue, ongoingText, paymentsOverview, studentColor } from "../lib/cycles";
import { slotsSentence } from "../lib/slots";
import { fmt, money, useAppData } from "../lib/useAppData";
import { createOneOffLesson, createSlots, markPaid, updateEnrollment } from "../services/api";
import LessonForm from "../components/LessonForm";
import { dayKey, toISO } from "../lib/lessons";
import type { Enrollment } from "../types";
import "./StudentsPage.css";

/* Élèves : retrouver un élève, voir sa fiche (matières, jours de cours, paiements), modifier ses tarifs.
   Tout est calculé à partir des données déjà chargées : aucune route serveur en plus.
   Un élève est créé en ajoutant son premier cours de la semaine (même formulaire que la page Cours). */
export default function StudentsPage() {
  const { data, error, notice, busy, load, run, clearNotice, clearError } = useAppData();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("");
  const [teacher, setTeacher] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [today] = useState(() => dayKey(new Date()));
  const [dialog, setDialog] = useState<{ kind: "add"; student: string; subject?: string; teacher?: string } | { kind: "one"; student: string } | { kind: "edit"; e: Enrollment } | null>(null);
  const uid = useId();

  const enrollments = data?.enrollments ?? [];
  const color = studentColor(enrollments);
  const o = data ? paymentsOverview(data) : null;
  const uniq = (f: (e: Enrollment) => string) => [...new Set(enrollments.map(f))].sort((a, b) => a.localeCompare(b));
  const norm = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

  const activeIds = data ? activeEnrollmentIds(data) : new Set<string>();
  /* Pour chaque élève : ses cours en cours (avec au moins un jour par semaine) et ses cours arrêtés.
     Un élève sans aucun cours en cours ni paiement à faire est un « ancien élève » : caché de la liste par défaut. */
  const students = uniq((e) => e.studentName).map((name) => {
    const list = enrollments.filter((e) => e.studentName === name).sort((a, b) => a.subjectName.localeCompare(b.subjectName));
    const active = list.filter((e) => activeIds.has(e.id));
    const stopped = list.filter((e) => !activeIds.has(e.id));
    const due = (o?.due ?? []).filter((x) => x.enrollment.studentName === name);
    const weekly = (data?.slots ?? []).filter((s) => list.some((e) => e.id === s.enrollmentId)).length;
    return { name, list, active, stopped, due, weekly, current: active.length > 0 || due.length > 0, late: due.some((x) => isOverdue(x.dueAt)) };
  });
  const oldCount = students.filter((s) => !s.current).length;
  const listed = students.filter((s) => showOld || s.current);
  const shown = listed.filter((s) =>
    (!q || norm(s.name).includes(norm(q))) && (!subject || s.list.some((e) => e.subjectName === subject)) && (!teacher || s.list.some((e) => e.teacherName === teacher)));
  const current = students.find((s) => s.name === params.get("eleve"));
  const open = (name: string | null) => { clearNotice(); setParams(name ? { eleve: name } : {}); window.scrollTo(0, 0); };
  const close = () => { setDialog(null); clearError(); };
  const modalError = error && dialog ? <Notice kind="error">{error}</Notice> : null;
  const status = (s: (typeof students)[number]) =>
    s.late ? <Badge tone="danger">Paiement en retard</Badge> : s.due.length ? <Badge tone="warning">Paiement à faire</Badge> : !s.current ? <Badge tone="neutral">Ancien élève</Badge> : <Badge tone="success">À jour</Badge>;

  return (
    <AppLayout>
      <div className="page">
        {!current ? (
          <PageHeader title="Élèves" sub="Retrouve un élève et sa fiche : matières, jours de cours et paiements.">
            {data && <button type="button" className="btn btn-primary" onClick={() => { clearNotice(); setDialog({ kind: "add", student: "" }); }}><Icon n="plus" /> Ajouter un élève</button>}
          </PageHeader>
        ) : (
          <div className="detail-top">
            <button type="button" className="btn btn-link" onClick={() => open(null)}><Icon n="back" /> Retour à la liste des élèves</button>
          </div>
        )}

        <PageMessages loaded={!!data} error={dialog ? "" : error} notice={notice} onRetry={() => void load()} onCloseError={clearError} onCloseNotice={clearNotice} />

        {data && !current && (
          <section className="card" aria-label="Liste des élèves">
            <div className="search-bar">
              <div className="field search">
                <label htmlFor={`${uid}-q`}>Rechercher un élève</label>
                <div className="input-ico"><Icon n="search" /><input id={`${uid}-q`} className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Écris un prénom" autoComplete="off" /></div>
              </div>
              <div className="field">
                <label htmlFor={`${uid}-s`}>Matière</label>
                <select id={`${uid}-s`} className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
                  <option value="">Toutes les matières</option>
                  {uniq((e) => e.subjectName).map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`${uid}-t`}>Enseignant</label>
                <select id={`${uid}-t`} className="input" value={teacher} onChange={(e) => setTeacher(e.target.value)}>
                  <option value="">Tous les enseignants</option>
                  {uniq((e) => e.teacherName).map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
            </div>
            <p className="result-count" role="status">
              {listed.length === 0 ? "" : shown.length === listed.length ? `${listed.length} élève${listed.length > 1 ? "s" : ""}` : `${shown.length} élève${shown.length > 1 ? "s" : ""} sur ${listed.length}`}
              {(q || subject || teacher) && <button type="button" className="btn btn-link" onClick={() => { setQ(""); setSubject(""); setTeacher(""); }}>Effacer la recherche</button>}
            </p>
            {oldCount > 0 && (
              <p className="old-toggle">
                <button type="button" className="btn btn-link" aria-pressed={showOld} onClick={() => setShowOld(!showOld)}>
                  {showOld ? "Masquer les anciens élèves" : `Afficher aussi les anciens élèves (${oldCount})`}
                </button>
                <span className="muted">Anciens élèves : plus aucun cours chaque semaine.</span>
              </p>
            )}
            {listed.length === 0 ? (
              <Empty icon="users" title="Aucun élève pour le moment">Appuie sur « Ajouter un élève » pour écrire son premier cours de la semaine.</Empty>
            ) : shown.length === 0 ? (
              <Empty icon="search" title="Aucun élève trouvé">Vérifie l'orthographe ou efface la recherche.</Empty>
            ) : (
              <ul className="rows">
                {shown.map((s) => (
                  <li key={s.name} className="row student-row">
                    <div className="row-main">
                      <Avatar name={s.name} color={color(s.name)} />
                      <div className="row-text">
                        <p className="row-title">{s.name}</p>
                        <p className="row-sub">{(s.active.length ? s.active : s.list).map((e) => `${e.subjectName} (${e.teacherName})`).join(", ")}</p>
                        <p className="row-sub">{s.weekly === 0 ? "Aucun cours chaque semaine" : `${s.weekly} cours par semaine`}</p>
                      </div>
                    </div>
                    {status(s)}
                    <div className="row-actions"><button type="button" className="btn btn-secondary btn-sm" onClick={() => open(s.name)}>Voir la fiche <Icon n="arrow" /></button></div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {data && current && (
          <>
            <header className="card card-pad student-head">
              <Avatar name={current.name} color={color(current.name)} large />
              <div className="row-text">
                <h1>{current.name}</h1>
                <p className="muted">{current.active.length} matière{current.active.length > 1 ? "s" : ""} · {current.weekly} cours par semaine</p>
              </div>
              {status(current)}
              <div className="student-actions">
                <button type="button" className="btn btn-primary" onClick={() => { clearNotice(); setDialog({ kind: "add", student: current.name }); }}><Icon n="plus" /> Ajouter un cours chaque semaine</button>
                <button type="button" className="btn btn-secondary" onClick={() => { clearNotice(); setDialog({ kind: "one", student: current.name }); }}><Icon n="plus" /> Ajouter un cours ponctuel</button>
                <Link className="btn btn-secondary" to={`/cours?eleve=${encodeURIComponent(current.name)}`}><Icon n="calendar" /> Voir son planning</Link>
              </div>
            </header>

            <section className="card" aria-labelledby="h-subj">
              <div className="card-head"><h2 id="h-subj">Matières suivies</h2><p className="card-sub">Pour chaque matière : l'enseignant, les jours de cours, et quand on paie.</p></div>
              <ul className="rows">
                {current.active.length === 0 && <li><Empty small>Plus aucun cours chaque semaine pour {current.name}.</Empty></li>}
                {current.active.map((e) => {
                  const ongoing = o?.ongoing.find((x) => x.enrollment.id === e.id);
                  const weekly = (data.slots ?? []).filter((s) => s.enrollmentId === e.id);
                  return (
                    <li key={e.id} className="subject">
                      <div className="subject-head">
                        <div><p className="row-title">{e.subjectName}</p><p className="row-sub">avec {e.teacherName}</p></div>
                        <div className="row-actions">
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { clearNotice(); setDialog({ kind: "add", student: e.studentName, subject: e.subjectName, teacher: e.teacherName }); }}><Icon n="plus" /> Ajouter un jour de cours</button>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { clearNotice(); setDialog({ kind: "edit", e }); }}><Icon n="edit" /> Modifier le prix et le nombre de cours</button>
                        </div>
                      </div>
                      <dl className="facts">
                        <div><dt>Jours de cours</dt><dd>{weekly.length === 0 ? "Aucun cours chaque semaine" : `${weekly.length > 1 ? `${weekly.length} fois par semaine : ` : ""}${slotsSentence([...weekly].sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7) || a.time.localeCompare(b.time)))}`}</dd></div>
                        <div><dt>Paiement</dt><dd>Au premier cours, pour {e.cycleSize} cours{e.price ? ` : ${money(e.price)}` : " (prix non indiqué)"}</dd></div>
                        {ongoing && (
                          <div><dt>Cycle en cours</dt><dd>
                            <div className="progress" aria-hidden="true"><span style={{ width: `${(ongoing.done / e.cycleSize) * 100}%` }} /></div>
                            {ongoingText(ongoing)}
                          </dd></div>
                        )}
                      </dl>
                    </li>
                  );
                })}
              </ul>
            </section>

            {current.stopped.length > 0 && (
              <p className="stopped-note muted">
                Autres cours (ponctuels ou arrêtés) : {current.stopped.map((e) => `${e.subjectName} avec ${e.teacherName}`).join(", ")}. Leurs cours passés et leurs paiements restent dans l'historique.
              </p>
            )}

            <section className="card" aria-labelledby="h-due">
              <div className="card-head"><h2 id="h-due">Paiements à faire</h2></div>
              {current.due.length === 0 ? <Empty small>Aucun paiement à faire pour {current.name}.</Empty> : (
                <ul className="rows">
                  {current.due.map((x) => (
                    <PaymentItem key={x.cycle.id} cycle={x.cycle} enrollment={x.enrollment} amount={x.amount} dueAt={x.dueAt} color={color(current.name)} busy={busy}
                      detail={`Paiement n° ${x.cycle.number}, pour ${x.enrollment.cycleSize} cours`} onPay={(id) => run(() => markPaid(id), "Le paiement est enregistré.")} />
                  ))}
                </ul>
              )}
            </section>

            <section className="card" aria-labelledby="h-hist">
              <div className="card-head"><h2 id="h-hist">Paiements déjà faits</h2></div>
              {(() => {
                const paid = (o?.paid ?? []).filter((x) => x.enrollment.studentName === current.name);
                return paid.length === 0 ? <Empty small>Aucun paiement enregistré pour le moment.</Empty> : (
                  <ul className="rows">
                    {paid.slice(0, 5).map((x) => (
                      <li key={x.cycle.id} className="row">
                        <div className="row-text" style={{ flex: "1 1 12rem" }}><p className="row-title">{x.enrollment.subjectName}</p><p className="row-sub">Payé le {x.cycle.paidAt ? fmt(x.cycle.paidAt, { day: "numeric", month: "long", year: "numeric" }) : "?"}</p></div>
                        <div className="row-meta"><Badge tone="success">Payé</Badge>{x.amount > 0 && <span className="amount">{money(x.amount)}</span>}</div>
                      </li>
                    ))}
                  </ul>
                );
              })()}
              <div className="card-foot"><Link className="btn btn-link" to={`/paiements?eleve=${encodeURIComponent(current.name)}`}>Voir tout l'historique de {current.name} <Icon n="arrow" /></Link></div>
            </section>

            <Notice kind="info">
              <strong>Retirer un élève</strong>
              Pour qu'un élève n'apparaisse plus dans le planning, arrête ses cours dans la page Cours (« Arrêter ce cours »). Ses cours passés et ses paiements restent enregistrés. En fin d'année, « Nouvelle année » dans les Réglages efface tous les élèves.
            </Notice>
          </>
        )}
      </div>

      <Modal open={dialog?.kind === "add"} title={dialog?.kind === "add" && dialog.subject ? `Ajouter un jour de cours : ${dialog.student}, ${dialog.subject}` : dialog?.kind === "add" && dialog.student ? `Ajouter un cours pour ${dialog.student}` : "Ajouter un élève"} onClose={close}>
        <p className="modal-intro">{dialog?.kind === "add" && dialog.student ? "Le cours s'affichera tout seul chaque semaine." : "Écris le nom de l'élève et son premier cours de la semaine. L'élève est créé en même temps."}</p>
        {modalError}
        {dialog?.kind === "add" && (
          <SlotForm initial={{ studentName: dialog.student, subjectName: dialog.subject, teacherName: dialog.teacher }} students={uniq((e) => e.studentName)} subjects={uniq((e) => e.subjectName)} teachers={uniq((e) => e.teacherName)} busy={busy} onCancel={close}
            submitLabel={dialog.student ? "Ajouter ce cours" : "Ajouter cet élève"}
            onSubmit={async (list) => { if (await run(() => createSlots(list), dialog.student ? `Cours ajouté : ${slotsSentence(list)}.` : `${list[0].studentName} est ajouté(e), avec son cours ${slotsSentence(list)}.`)) setDialog(null); }} />
        )}
      </Modal>

      <Modal open={dialog?.kind === "one"} title={dialog?.kind === "one" ? `Cours ponctuel pour ${dialog.student}` : ""} onClose={close}>
        <p className="modal-intro">Un cours qui n'a lieu qu'une fois, avec un enseignant déjà enregistré ou un nouveau.</p>
        {modalError}
        {dialog?.kind === "one" && (
          <LessonForm enrollments={enrollments.filter((e) => e.studentName === dialog.student)} initialStudent={dialog.student}
            names={{ students: uniq((e) => e.studentName), subjects: uniq((e) => e.subjectName), teachers: uniq((e) => e.teacherName) }}
            initial={{ enrollmentId: "", date: today, time: "16:00", status: "planned", notes: "" }} submitLabel="Ajouter ce cours" busy={busy} onCancel={close}
            onSubmit={async (v) => {
              const lesson = { date: toISO(v.date, v.time), status: v.status, notes: v.notes.trim() || undefined };
              if (await run(() => createOneOffLesson(v.newCourse ? { newCourse: v.newCourse } : { enrollmentId: v.enrollmentId }, lesson), "Cours ponctuel ajouté au planning.")) setDialog(null);
            }} />
        )}
      </Modal>

      <Modal open={dialog?.kind === "edit"} title="Modifier le prix et le nombre de cours" onClose={close}>
        {dialog?.kind === "edit" && (
          <>
            <p className="modal-intro"><strong>{dialog.e.studentName}</strong> · {dialog.e.subjectName} avec {dialog.e.teacherName}</p>
            {modalError}
            <EnrollmentForm e={dialog.e} busy={busy} onCancel={close}
              onSave={async (cycleSize, price) => { if (await run(() => updateEnrollment(dialog.e.id, { cycleSize, price }), "Modifications enregistrées.")) setDialog(null); }} />
          </>
        )}
      </Modal>
    </AppLayout>
  );
}
