import { useId, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import Icon from "../components/Icon";
import { Confirm } from "../components/Modal";
import PaymentItem from "../components/PaymentItem";
import { Avatar, Badge, Empty, Notice, PageHeader, PageMessages, Stat } from "../components/ui";
import { isOverdue, paymentsOverview, studentColor } from "../lib/cycles";
import { monthKey, timeOf } from "../lib/lessons";
import { cap, fmt, money, useAppData } from "../lib/useAppData";
import { markPaid, markUnpaid } from "../services/api";
import type { PaymentCycle } from "../types";
import "./PaymentsPage.css";

export default function PaymentsPage() {
  const { data, error, notice, busy, load, run, clearNotice, clearError } = useAppData();
  const [params] = useSearchParams();
  const [student, setStudent] = useState(() => params.get("eleve") ?? "");
  const [fixing, setFixing] = useState<PaymentCycle | null>(null);
  const uid = useId();

  const o = data ? paymentsOverview(data) : null;
  const color = studentColor(data?.enrollments ?? []);
  const students = [...new Set((data?.enrollments ?? []).map((e) => e.studentName))].sort();
  const who = students.includes(student) ? student : "";
  const history = (o?.paid ?? []).filter((x) => !who || x.enrollment.studentName === who);
  const months = [...new Set(history.map((x) => monthKey(x.cycle.paidAt ?? "")))];
  const late = (o?.due ?? []).filter((x) => isOverdue(x.doneAt));
  const fixingInfo = fixing && o?.paid.find((x) => x.cycle.id === fixing.id);

  return (
    <AppLayout>
      <div className="page">
        <PageHeader title="Paiements" sub="Ce qu'il faut payer aux enseignants, et ce qui est déjà payé." />
        <PageMessages loaded={!!data} error={fixing ? "" : error} notice={notice} onRetry={() => void load()} onCloseError={clearError} onCloseNotice={clearNotice} />

        {o && (
          <>
            <section className="stats" aria-label="Résumé des paiements">
              <Stat icon="wallet" tone="warning" value={o.due.length} label="Paiements en attente" />
              <Stat icon="alert" tone="accent" value={late.length} label="Paiements en retard" />
              <Stat icon="wallet" value={money(o.totalDue)} label="Montant à payer" />
              <Stat icon="check" tone="success" value={money(o.totalPaid)} label="Total déjà payé" />
            </section>

            <div className="grid-2">
              <section className="card" aria-labelledby="h-due">
                <div className="card-head"><h2 id="h-due">À payer</h2>{o.due.length > 0 && <span className="amount">{money(o.totalDue)}</span>}<p className="card-sub">Le nombre de cours prévu est atteint : il faut payer l'enseignant.</p></div>
                {o.due.length === 0 ? <Empty icon="check" title="Rien à payer pour le moment">Les paiements apparaîtront ici quand le nombre de cours sera atteint.</Empty> : (
                  <ul className="rows">
                    {o.due.map((x) => (
                      <PaymentItem key={x.cycle.id} cycle={x.cycle} enrollment={x.enrollment} amount={x.amount} doneAt={x.doneAt} color={color(x.enrollment.studentName)} busy={busy}
                        detail={`Paiement n° ${x.cycle.number}, ${x.enrollment.cycleSize} cours${x.doneAt ? `. Dernier cours : ${fmt(x.doneAt, { weekday: "long", day: "numeric", month: "long" })}` : ""}`}
                        onPay={(id) => run(() => markPaid(id), "Le paiement est enregistré. Il apparaît dans l'historique, plus bas.")} />
                    ))}
                  </ul>
                )}
                <div className="card-foot legend">
                  <span><Badge tone="warning">À payer</Badge> le nombre de cours est atteint cette semaine</span>
                  <span><Badge tone="danger">En retard</Badge> atteint depuis plus d'une semaine</span>
                </div>
              </section>

              <section className="card" aria-labelledby="h-going">
                <div className="card-head"><h2 id="h-going">Bientôt à payer</h2><p className="card-sub">Combien de cours avant le prochain paiement.</p></div>
                {o.ongoing.length === 0 ? <Empty small>Aucun cours pour le moment. Ajoute-en un dans la page Cours.</Empty> : (
                  <ul className="rows">
                    {o.ongoing.map(({ enrollment: e, done, remaining }) => (
                      <li key={e.id} className="row">
                        <div className="row-main">
                          <Avatar name={e.studentName} color={color(e.studentName)} />
                          <div className="row-text">
                            <p className="row-title">{e.studentName} · {e.subjectName}</p>
                            <p className="row-sub">{remaining > 0 ? `Encore ${remaining} cours avant de payer ${e.teacherName}` : `Nombre de cours atteint`}{e.price ? ` (${money(e.price)})` : ""}</p>
                          </div>
                        </div>
                        <div className="going-progress">
                          <div className={`progress${remaining === 0 ? " is-full" : ""}`} aria-hidden="true"><span style={{ width: `${(done / e.cycleSize) * 100}%` }} /></div>
                          <span className="muted">{done} cours sur {e.cycleSize}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <section className="card" aria-labelledby="h-hist">
              <div className="card-head">
                <div><h2 id="h-hist">Historique des paiements</h2><p className="muted">{history.length === 0 ? "Aucun paiement" : `${history.length} paiement${history.length > 1 ? "s" : ""} enregistré${history.length > 1 ? "s" : ""}`}</p></div>
                {students.length > 1 && (
                  <div className="field hist-filter">
                    <label htmlFor={`${uid}-st`}>Élève</label>
                    <select id={`${uid}-st`} className="input" value={who} onChange={(e) => setStudent(e.target.value)}>
                      <option value="">Tous les élèves</option>
                      {students.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                )}
              </div>
              {history.length === 0 ? <Empty icon="wallet" title="Pas encore de paiement">Les paiements marqués « payé » apparaîtront ici.</Empty> : months.map((m) => (
                <section key={m} className="month" aria-labelledby={`m-${m}`}>
                  <h3 id={`m-${m}`} className="month-title">{cap(fmt(`${m}-01T12:00`, { month: "long", year: "numeric" }))}</h3>
                  <table className="table">
                    <thead><tr><th>Élève</th><th>Paiement</th><th>Payé le</th><th className="num">Montant</th><th>Statut</th><th><span className="sr-only">Actions</span></th></tr></thead>
                    <tbody>
                      {history.filter((x) => monthKey(x.cycle.paidAt ?? "") === m).map(({ cycle, enrollment: e, amount, lessons, corrected }) => (
                        <tr key={cycle.id}>
                          <td className="td-main"><div className="row-main"><Avatar name={e.studentName} color={color(e.studentName)} /><div className="row-text"><p className="row-title">{e.studentName}</p><p className="row-sub">{e.subjectName} avec {e.teacherName}</p></div></div></td>
                          <td data-label="Paiement">N° {cycle.number}, {e.cycleSize} cours</td>
                          <td data-label="Payé le">{cycle.paidAt ? fmt(cycle.paidAt, { weekday: "long", day: "numeric", month: "long" }) : ""}</td>
                          <td data-label="Montant" className="num"><span className="amount">{amount > 0 ? money(amount) : "—"}</span></td>
                          <td data-label="Statut"><span className="status-cell"><Badge tone="success">Payé</Badge>{corrected && <Badge tone="neutral">Déjà corrigé une fois</Badge>}</span></td>
                          <td className="td-actions">
                            <div className="hist-actions">
                              {lessons.length > 0 && (
                                <details className="more">
                                  <summary>Voir les {lessons.length} cours</summary>
                                  <ul className="lesson-dates">{lessons.map((l) => <li key={l.id}>{cap(fmt(l.date, { weekday: "long", day: "numeric", month: "long" }))} à {timeOf(l.date)}</li>)}</ul>
                                </details>
                              )}
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { clearNotice(); setFixing(cycle); }}><Icon n="undo" /> Corriger ce paiement</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
            </section>
          </>
        )}
      </div>

      <Confirm open={!!fixing} title="Corriger ce paiement ?" confirmLabel="Oui, remettre à payer" cancelLabel="Non, garder le paiement" tone="danger" busy={busy}
        onCancel={() => { setFixing(null); clearError(); }}
        onConfirm={async () => { if (fixing && await run(() => markUnpaid(fixing.id), "Le paiement est remis « à payer ».")) setFixing(null); }}>
        {error && <Notice kind="error">{error}</Notice>}
        {fixingInfo && <p>Paiement de <strong>{fixingInfo.enrollment.studentName}</strong> ({fixingInfo.enrollment.subjectName}){fixingInfo.amount > 0 ? <>, {money(fixingInfo.amount)}</> : null}.</p>}
        <p>À utiliser si ce paiement a été marqué « payé » par erreur : il redeviendra « à payer ».</p>
        <p className="muted">Cette correction reste notée dans l'historique.</p>
      </Confirm>
    </AppLayout>
  );
}
