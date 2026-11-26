import { useCallback, useEffect, useState, type CSSProperties } from "react";
import FridgeFrame from "../components/FridgeFrame";
import Header from "../components/Header";
import PayCard from "../components/PayCard";
import { paymentsOverview, studentColor } from "../lib/cycles";
import { monthKey, timeOf } from "../lib/lessons";
import { scrollToId } from "../lib/slots";
import { fetchDashboard, markPaid, markUnpaid } from "../services/api";
import { ApiError } from "../services/auth";
import type { DashboardData } from "../types";
import "./PaymentsPage.css";

const fmt = (d: Date | string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", o).format(new Date(d));
const money = (n: number) => `${n.toLocaleString("fr-FR")} DA`;
const cap = (t: string) => t[0].toUpperCase() + t.slice(1);

export default function PaymentsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [student, setStudent] = useState("all");
  const [fixId, setFixId] = useState<string | null>(null);

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

  const o = data ? paymentsOverview(data) : null;
  const color = studentColor(data?.enrollments ?? []);
  const who = (name: string) => ({ "--c": color(name) }) as CSSProperties;
  const students = [...new Set((data?.enrollments ?? []).map((e) => e.studentName))].sort();
  const history = (o?.paid ?? []).filter((x) => student === "all" || x.enrollment.studentName === student);
  const months = [...new Set(history.map((x) => monthKey(x.cycle.paidAt ?? "")))];
  const stats = o && [
    { n: String(o.due.length), t: "Paiements à régler", p: "#ffcf8f", m: "#2f7de1" },
    { n: money(o.totalDue), t: "Montant à payer", p: "#ffb3c7", m: "#1d9a63", money: true },
    { n: String(o.paid.length), t: "Cycles payés", p: "#c2eba0", m: "#d62f4b" },
    { n: money(o.totalPaid), t: "Total payé", p: "#d9c8ff", m: "#f2b705", money: true },
  ];

  return (
    <main className="fridge fridge--board">
      <FridgeFrame />
      <div className="board">
        <Header />
        {error && <p className="form-error" role="alert">{error}</p>}
        {!data && !error && <p className="loading" role="status">Chargement…</p>}
        {notice && <p className="notice" role="status">{notice}</p>}

        {o && stats && (
          <>
            <section className="stats" aria-label="Résumé">
              {stats.map((x) => (
                <div key={x.t} className="stat" style={{ "--p": x.p } as CSSProperties}>
                  <i className="magnet" style={{ "--m": x.m } as CSSProperties} />
                  <span className={`num${x.money ? " money" : ""}`}>{x.n}</span>
                  <span className="lab">{x.t}</span>
                </div>
              ))}
            </section>

            {/* Téléphone : aller directement à une partie de la page */}
            <div className="jumpbar m-only" role="group" aria-label="Aller à">
              <button type="button" className="chip" onClick={() => scrollToId("h-due")}>À payer <b className="jb-n">{o.due.length}</b></button>
              <button type="button" className="chip" onClick={() => scrollToId("h-going")}>Bientôt</button>
              <button type="button" className="chip" onClick={() => scrollToId("h-hist")}>Historique</button>
            </div>

            <div className="pgrid">
              <section className="sheet due" aria-labelledby="h-due">
                <i className="magnet big" aria-hidden="true" />
                <h2 id="h-due">À payer</h2>
                <p className="sub">Les cycles complets, de toutes les semaines.</p>
                {o.due.length === 0 && <p className="empty">Rien à payer pour le moment.</p>}
                <ul>
                  {o.due.map((x) => (
                    <PayCard key={x.cycle.id} cycle={x.cycle} enrollment={x.enrollment} amount={x.amount} color={color(x.enrollment.studentName)} busy={busy}
                      detail={`Cycle ${x.cycle.number}, ${x.enrollment.cycleSize} cours${x.doneAt ? `. Dernier cours : ${fmt(x.doneAt, { weekday: "long", day: "numeric", month: "long" })}` : ""}`}
                      onPay={(id) => run(() => markPaid(id), "Le paiement est enregistré.")} />
                  ))}
                </ul>
                <p className="foot">Appuie sur « Marquer comme payé » quand tu as donné l'argent. Le paiement passe alors dans l'historique, plus bas.</p>
              </section>

              <section className="sheet going" aria-labelledby="h-going">
                <i className="magnet" style={{ "--m": "#2f7de1" } as CSSProperties} aria-hidden="true" />
                <h2 id="h-going">Bientôt à payer</h2>
                <p className="sub">Combien de cours avant le prochain paiement.</p>
                {o.ongoing.length === 0 && <p className="empty">Aucun cours pour le moment. Ajoute-en un dans la page Cours.</p>}
                <ul>
                  {o.ongoing.map(({ enrollment: e, done, remaining }) => (
                    <li key={e.id} className="item" style={who(e.studentName)}>
                      <p className="stu">{e.studentName}</p>
                      <p className="l2">{e.subjectName} avec {e.teacherName}</p>
                      <div className="dots" aria-hidden="true">{Array.from({ length: e.cycleSize }, (_, i) => <span key={i} className={`dot${i < done ? " on" : ""}`} />)}</div>
                      <p className="when">{done} cours sur {e.cycleSize}. {remaining > 0 ? `Encore ${remaining} avant le paiement.` : "Le cycle est complet."}</p>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <section className="fiche" aria-labelledby="h-hist">
              <i className="magnet big" aria-hidden="true" />
              <h2 id="h-hist">Historique des paiements</h2>
              <p className="sub">{history.length === 0 ? "Aucun paiement" : `${history.length} paiement${history.length > 1 ? "s" : ""} enregistré${history.length > 1 ? "s" : ""}`}</p>
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
              {history.length === 0 && <p className="none">Les paiements marqués « payé » apparaîtront ici.</p>}
              {months.map((m) => (
                <section key={m} className="monthblock" aria-label={cap(fmt(`${m}-01T12:00`, { month: "long", year: "numeric" }))}>
                  <h3 className="day">{cap(fmt(`${m}-01T12:00`, { month: "long", year: "numeric" }))}</h3>
                  <ul>
                    {history.filter((x) => monthKey(x.cycle.paidAt ?? "") === m).map(({ cycle, enrollment: e, amount, lessons, corrected }) => (
                      <li key={cycle.id} className="prow" style={who(e.studentName)}>
                        <i className="gom" aria-hidden="true" />
                        <div className="l1"><strong className="stu">{e.studentName}</strong>{amount > 0 && <span className="amount paidamt">{money(amount)}</span>}</div>
                        <p className="l2">{e.subjectName} avec {e.teacherName}</p>
                        <p className="when">Cycle {cycle.number}, {e.cycleSize} cours. Payé le {cycle.paidAt ? fmt(cycle.paidAt, { weekday: "long", day: "numeric", month: "long" }) : ""}.</p>
                        {corrected && <p className="note">Ce paiement a déjà été corrigé une fois.</p>}
                        {lessons.length > 0 && (
                          <details className="oneoff">
                            <summary>Voir les {lessons.length} cours de ce cycle</summary>
                            <ul className="cl">{lessons.map((l) => <li key={l.id}>{cap(fmt(l.date, { weekday: "long", day: "numeric", month: "long" }))} à {timeOf(l.date)}</li>)}</ul>
                          </details>
                        )}
                        {fixId === cycle.id ? (
                          <div className="confirm" role="group" aria-label="Corriger ce paiement">
                            <p>Ce paiement a été marqué par erreur ? Le cycle redeviendra « à payer ».</p>
                            <button className="primary danger" disabled={busy} onClick={async () => { if (await run(() => markUnpaid(cycle.id), "Le paiement est remis à payer.")) setFixId(null); }}>{busy ? "Un instant…" : "Oui, remettre à payer"}</button>
                            <button className="ghost" disabled={busy} onClick={() => setFixId(null)}>Non, garder le paiement</button>
                          </div>
                        ) : <button className="ghost small" onClick={() => { setFixId(cycle.id); setNotice(""); }}>Corriger ce paiement</button>}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
