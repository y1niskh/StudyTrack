import { useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import Icon from "../components/Icon";
import PaymentItem from "../components/PaymentItem";
import { Avatar, Badge, Empty, LessonBadge, Notice, PageHeader, PageMessages, Stat } from "../components/ui";
import { isOverdue, paymentsOverview, studentColor, summarize } from "../lib/cycles";
import { timeOf } from "../lib/lessons";
import { lessonsToConfirm } from "../lib/slots";
import { cap, fmt, money, useAppData } from "../lib/useAppData";
import { markPaid } from "../services/api";
import { getSession } from "../services/auth";
import type { Enrollment, Lesson } from "../types";
import "./DashboardPage.css";

/* Accueil : répond tout de suite à « qu'est-ce que je dois faire aujourd'hui ? » */
export default function DashboardPage() {
  const { data, error, notice, busy, load, run, clearNotice, clearError } = useAppData();
  const [now] = useState(() => new Date());
  const name = getSession()?.user.name;

  const s = data ? summarize(data, now) : null;
  const o = data ? paymentsOverview(data) : null;
  const toConfirm = data ? lessonsToConfirm(data, now) : [];
  const overdue = o ? o.due.filter((x) => isOverdue(x.doneAt, now)) : [];
  const color = studentColor(data?.enrollments ?? []);
  const studentCount = new Set((data?.enrollments ?? []).map((e) => e.studentName)).size;
  const upcoming = o ? o.ongoing.filter((x) => x.done > 0 && x.remaining > 0).slice(0, 4) : [];
  const pay = (id: string) => run(() => markPaid(id), "Le paiement est enregistré. Il apparaît maintenant dans l'historique.", "Le paiement n'a pas pu être enregistré. Vérifie la connexion Internet et réessaie.");

  const lessonList = (list: { lesson: Lesson; enrollment: Enrollment }[], empty: string) =>
    list.length === 0 ? <Empty small>{empty}</Empty> : (
      <ul className="rows">
        {list.map(({ lesson, enrollment: e }) => (
          <li key={lesson.id} className="row">
            <div className="row-main">
              <span className="time">{timeOf(lesson.date)}</span>
              <Avatar name={e.studentName} color={color(e.studentName)} />
              <div className="row-text"><p className="row-title">{e.studentName}</p><p className="row-sub">{e.subjectName} avec {e.teacherName}</p></div>
            </div>
            <LessonBadge status={lesson.status} />
          </li>
        ))}
      </ul>
    );

  return (
    <AppLayout>
      <div className="page">
        <PageHeader title={`Bonjour${name ? ` ${name}` : ""} !`} sub={`${cap(fmt(now, { weekday: "long", day: "numeric", month: "long" }))}. Voici l'essentiel de la journée.`} />

        <PageMessages loaded={!!data} error={error} notice={notice} onRetry={() => void load()} onCloseError={clearError} onCloseNotice={clearNotice} />

        {s && o && (
          <>
            {(toConfirm.length > 0 || overdue.length > 0) && (
              <section className="attention" aria-labelledby="h-att">
                <h2 id="h-att" className="sr-only">À faire en priorité</h2>
                {toConfirm.length > 0 && (
                  <Notice kind="warning" action={<Link className="btn btn-secondary btn-sm" to="/cours">Confirmer les cours <Icon n="arrow" /></Link>}>
                    <strong>{toConfirm.length} cours à confirmer</strong>
                    Ces cours sont passés. Indique s'ils ont eu lieu : les paiements se calculent ensuite tout seuls.
                  </Notice>
                )}
                {overdue.length > 0 && (
                  <Notice kind="error" action={<Link className="btn btn-secondary btn-sm" to="/paiements">Voir les paiements <Icon n="arrow" /></Link>}>
                    <strong>{overdue.length} paiement{overdue.length > 1 ? "s" : ""} en retard</strong>
                    Le nombre de cours prévu est atteint depuis plus d'une semaine.
                  </Notice>
                )}
              </section>
            )}

            <section className="stats" aria-label="Chiffres clés">
              <Stat icon="users" value={studentCount} label={studentCount > 1 ? "Élèves inscrits" : "Élève inscrit"} />
              <Stat icon="calendar" value={s.todayLessons.length} label="Cours aujourd'hui" />
              <Stat icon="wallet" tone="warning" value={o.due.length} label="Paiements en attente" />
              <Stat icon="wallet" tone="accent" value={money(o.totalDue)} label="Montant à payer" />
            </section>

            <div className="grid-2">
              <div className="stack">
                <section className="card" aria-labelledby="h-today">
                  <div className="card-head"><h2 id="h-today">Cours d'aujourd'hui</h2><span className="muted">{cap(fmt(s.today, { weekday: "long", day: "numeric", month: "long" }))}</span></div>
                  {lessonList(s.todayLessons, "Pas de cours aujourd'hui.")}
                </section>
                <section className="card" aria-labelledby="h-tom">
                  <div className="card-head"><h2 id="h-tom">Cours de demain</h2><span className="muted">{cap(fmt(s.tomorrow, { weekday: "long", day: "numeric", month: "long" }))}</span></div>
                  {lessonList(s.tomorrowLessons, "Pas de cours prévu demain.")}
                  <div className="card-foot"><Link className="btn btn-link" to="/cours">Voir tout le planning <Icon n="arrow" /></Link></div>
                </section>
              </div>

              <div className="stack">
                <section className="card" aria-labelledby="h-pay">
                  <div className="card-head"><h2 id="h-pay">Paiements à faire</h2>{o.due.length > 0 && <span className="amount">{money(o.totalDue)}</span>}</div>
                  {o.due.length === 0 ? <Empty small>Rien à payer pour le moment.</Empty> : (
                    <ul className="rows">
                      {o.due.map((x) => (
                        <PaymentItem key={x.cycle.id} cycle={x.cycle} enrollment={x.enrollment} amount={x.amount} doneAt={x.doneAt} color={color(x.enrollment.studentName)} busy={busy}
                          detail={x.doneAt ? `Dernier cours : ${fmt(x.doneAt, { weekday: "long", day: "numeric", month: "long" })}` : undefined} onPay={pay} />
                      ))}
                    </ul>
                  )}
                  <div className="card-foot"><Link className="btn btn-link" to="/paiements">Voir les paiements <Icon n="arrow" /></Link></div>
                </section>

                <section className="card" aria-labelledby="h-next">
                  <div className="card-head"><h2 id="h-next">Prochaines échéances</h2><p className="card-sub">Les paiements qui arrivent bientôt.</p></div>
                  {upcoming.length === 0 ? <Empty small>Aucun paiement ne s'approche pour le moment.</Empty> : (
                    <ul className="rows">
                      {upcoming.map(({ enrollment: e, done, remaining }) => (
                        <li key={e.id} className="row">
                          <div className="row-main">
                            <Avatar name={e.studentName} color={color(e.studentName)} />
                            <div className="row-text">
                              <p className="row-title">{e.studentName} · {e.subjectName}</p>
                              <p className="row-sub">Encore {remaining} cours avant de payer {e.teacherName}{e.price ? ` (${money(e.price)})` : ""}</p>
                            </div>
                          </div>
                          <div className="next-progress" aria-label={`${done} cours faits sur ${e.cycleSize}`}>
                            <div className="progress" aria-hidden="true"><span style={{ width: `${(done / e.cycleSize) * 100}%` }} /></div>
                            <span className="muted">{done} sur {e.cycleSize}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="card" aria-labelledby="h-paid">
                  <div className="card-head"><h2 id="h-paid">Payés cette semaine</h2></div>
                  {s.paidThisWeek.length === 0 ? <Empty small>Aucun paiement cette semaine.</Empty> : (
                    <ul className="rows">
                      {s.paidThisWeek.map(({ cycle, enrollment: e, amount }) => (
                        <li key={cycle.id} className="row">
                          <div className="row-main">
                            <Avatar name={e.studentName} color={color(e.studentName)} />
                            <div className="row-text"><p className="row-title">{e.studentName}</p><p className="row-sub">{e.subjectName}{cycle.paidAt ? `, payé ${fmt(cycle.paidAt, { weekday: "long" })}` : ""}</p></div>
                          </div>
                          <div className="row-meta"><Badge tone="success">Payé</Badge>{amount > 0 && <span className="amount">{money(amount)}</span>}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
