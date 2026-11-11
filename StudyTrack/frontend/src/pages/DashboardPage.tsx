import { useCallback, useEffect, useState, type CSSProperties } from "react";
import Header from "../components/Header";
import FridgeFrame from "../components/FridgeFrame";
import { addDays, studentColor, summarize } from "../lib/cycles";
import { fetchDashboard, markPaid } from "../services/api";
import { ApiError } from "../services/auth";
import type { DashboardData, Enrollment } from "../types";
import "./DashboardPage.css";

const fmt = (d: Date | string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", o).format(new Date(d));
const money = (n: number) => `${n.toLocaleString("fr-FR")} DA`;

const PATHS = {
  check: "M5 13l4 4L19 7",
  alert: "M12 4 2 20h20zM12 10v4M12 17.5v.5",
};
const Ico = ({ n }: { n: keyof typeof PATHS }) => <svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d={PATHS[n]} /></svg>;

type DueItem = ReturnType<typeof summarize>["dueThisWeek"][number];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const d = await fetchDashboard(); setData(d); setError(""); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Impossible de charger les données."); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function run(job: () => Promise<unknown>, fail: string, after: () => void) {
    setBusy(true);
    try { await job(); after(); await load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : fail); }
    finally { setBusy(false); }
  }

  const s = data ? summarize(data) : null;
  const color = studentColor(data?.enrollments ?? []);
  const who = (e: Enrollment) => ({ "--c": color(e.studentName) }) as CSSProperties;

  const PayCard = ({ o }: { o: DueItem }) => {
    const e = o.enrollment;
    return (
      <li className="item" style={who(e)}>
        <div className="row">
          <p className="stu">{e.studentName}</p>
          {o.amount > 0 && <p className="amount">{money(o.amount)}</p>}
        </div>
        <p className="l2">{e.subjectName} avec {e.teacherName}</p>
        {confirmId === o.cycle.id ? (
          <div className="confirm" role="group" aria-label="Confirmation du paiement">
            <p>As-tu bien payé {e.teacherName} ?</p>
            <button className="primary" disabled={busy} onClick={() => void run(() => markPaid(o.cycle.id), "Le paiement n'a pas pu être enregistré.", () => setConfirmId(null))}>
              {busy ? "Un instant…" : "Oui, c'est payé"}
            </button>
            <button className="ghost" disabled={busy} onClick={() => setConfirmId(null)}>Non, annuler</button>
          </div>
        ) : (
          <button className="primary" onClick={() => setConfirmId(o.cycle.id)}>Marquer comme payé</button>
        )}
      </li>
    );
  };

  /* La note la plus haute prend tout un côté ; les deux autres se partagent l'autre côté : pas de trou. */
  const span = !s ? "pay" : (() => {
    const h = { lined: 130 + 64 * s.tomorrowLessons.length, pay: 130 + 150 * s.dueThisWeek.length + (s.overdue.length ? 70 : 0), paid: 130 + 90 * s.paidThisWeek.length };
    return (Object.keys(h) as (keyof typeof h)[]).reduce((a, b) => (h[b] > h[a] ? b : a));
  })();
  const stats = s && [
    { n: String(s.tomorrowLessons.length), t: "Cours demain", p: "#9fd8ff", m: "#f2b705" },
    { n: String(s.dueThisWeek.length), t: "À payer cette semaine", p: "#ffcf8f", m: "#2f7de1" },
    { n: money(s.totalDue), t: "Montant à payer", p: "#ffb3c7", m: "#1d9a63", money: true },
    { n: String(s.paidThisWeek.length), t: "Payés cette semaine", p: "#c2eba0", m: "#d62f4b" },
  ];
  const weekLabel = s && (() => {
    const last = addDays(s.week.start, 6);
    const same = s.week.start.getMonth() === last.getMonth();
    return `du ${fmt(s.week.start, same ? { weekday: "long", day: "numeric" } : { weekday: "long", day: "numeric", month: "long" })} au ${fmt(last, { weekday: "long", day: "numeric", month: "long" })}`;
  })();

  return (
    <main className="fridge fridge--board">
      <FridgeFrame />
      <div className="board">
        <Header />

        {error && <p className="form-error" role="alert">{error} <button className="ghost" onClick={() => void load()}>Réessayer</button></p>}
        {!data && !error && <p className="loading" role="status">Chargement…</p>}

        {s && stats && (
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

            <div className="cols" data-span={span}>
              <section className="lined" aria-labelledby="h-next">
                <i className="magnet big" aria-hidden="true" />
                <h2 id="h-next">Cours de demain</h2>
                <p className="sub">{fmt(s.tomorrow, { weekday: "long", day: "numeric", month: "long" })}</p>
                {s.tomorrowLessons.length === 0 && <p className="empty">Pas de cours demain.</p>}
                <ul>
                  {s.tomorrowLessons.map(({ lesson, enrollment: e }) => (
                    <li key={lesson.id} className="lesson" style={who(e)}>
                      <i className="gom" aria-hidden="true" />
                      <p className="l1"><span className="time">{fmt(lesson.date, { hour: "2-digit", minute: "2-digit" })}</span><strong className="stu">{e.studentName}</strong></p>
                      <p className="l2">{e.subjectName} avec {e.teacherName}</p>
                    </li>
                  ))}
                </ul>
              </section>

                <section className="sheet pay" aria-labelledby="h-pay">
                  <i className="magnet big" aria-hidden="true" />
                  <h2 id="h-pay">À payer cette semaine</h2>
                  <p className="sub">{weekLabel}</p>
                  {s.dueThisWeek.length === 0 && <p className="empty">Rien à payer cette semaine.</p>}
                  <ul>{s.dueThisWeek.map((o) => <PayCard key={o.cycle.id} o={o} />)}</ul>
                  {s.overdue.length > 0 && (
                    <details className="late">
                      <summary><Ico n="alert" /> {s.overdue.length} paiement{s.overdue.length > 1 ? "s" : ""} en retard (semaines passées)</summary>
                      <ul>{s.overdue.map((o) => <PayCard key={o.cycle.id} o={o} />)}</ul>
                    </details>
                  )}
                </section>

                <section className="sheet paid" aria-labelledby="h-paid">
                  <i className="magnet" style={{ "--m": "#1d9a63" } as CSSProperties} aria-hidden="true" />
                  <h2 id="h-paid">Payés cette semaine</h2>
                  {s.paidThisWeek.length === 0 && <p className="empty">Aucun paiement cette semaine.</p>}
                  <ul>
                    {s.paidThisWeek.map(({ cycle, enrollment: e, amount }) => (
                      <li key={cycle.id} className="item" style={who(e)}>
                        <p className="stu"><Ico n="check" /> {e.studentName}</p>
                        <p className="l2">{e.subjectName}, {money(amount)}, payé {cycle.paidAt ? fmt(cycle.paidAt, { weekday: "long" }) : ""}</p>
                      </li>
                    ))}
                  </ul>
                </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
