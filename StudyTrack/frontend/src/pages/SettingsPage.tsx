import { useCallback, useEffect, useId, useState, type CSSProperties, type FormEvent } from "react";
import FridgeFrame from "../components/FridgeFrame";
import Header from "../components/Header";
import NewYearReset from "../components/NewYearReset";
import { studentColor } from "../lib/cycles";
import { downloadBackup } from "../lib/backup";
import { getTextScale, setTextScale, TEXT_SCALES } from "../lib/prefs";
import { WEEKDAYS } from "../lib/slots";
import { fetchDashboard, updateEnrollment } from "../services/api";
import { ApiError, getSession } from "../services/auth";
import type { DashboardData, Enrollment } from "../types";
import "../components/LessonForm.css";
import "./SettingsPage.css";

const money = (n: number) => `${n.toLocaleString("fr-FR")} DA`;

/* Modifier le nombre de cours avant paiement et le prix d'un cours suivi */
function EnrollmentForm({ e, busy, onSave, onCancel }: { e: Enrollment; busy: boolean; onSave: (cycleSize: number, price: number | null) => void; onCancel: () => void }) {
  const uid = useId();
  const [size, setSize] = useState(String(e.cycleSize));
  const [price, setPrice] = useState(e.price === undefined ? "" : String(e.price));
  const [err, setErr] = useState("");
  function submit(ev: FormEvent) {
    ev.preventDefault();
    const n = Number(size);
    if (!Number.isInteger(n) || n < 1) return setErr("Le nombre de cours avant paiement doit être un nombre entier, par exemple 4.");
    const p = price.trim() === "" ? null : Number(price);
    if (p !== null && (!Number.isFinite(p) || p < 0)) return setErr("Le prix doit être un nombre, par exemple 6000.");
    setErr(""); onSave(n, p);
  }
  return (
    <form className="lf" onSubmit={submit} noValidate>
      <div className="lf-two">
        <div className="lf-field"><label htmlFor={`${uid}-s`}>Payer tous les … cours</label><input id={`${uid}-s`} type="number" min={1} inputMode="numeric" value={size} onChange={(x) => setSize(x.target.value)} /></div>
        <div className="lf-field"><label htmlFor={`${uid}-p`}>Prix du paiement, en DA</label><input id={`${uid}-p`} type="number" min={0} inputMode="numeric" value={price} onChange={(x) => setPrice(x.target.value)} placeholder="6000" /></div>
      </div>
      <p className="lf-hint">Les paiements déjà faits ne changent pas. Le nouveau prix compte pour les paiements pas encore faits.</p>
      {err && <p className="lf-error" role="alert">{err}</p>}
      <div className="lf-actions">
        <button className="primary" type="submit" disabled={busy}>{busy ? "Un instant…" : "Enregistrer"}</button>
        <button className="ghost" type="button" onClick={onCancel} disabled={busy}>Annuler</button>
      </div>
    </form>
  );
}

export default function SettingsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [scale, setScale] = useState(getTextScale);
  const user = getSession()?.user;

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

  const enrollments = [...(data?.enrollments ?? [])].sort((a, b) => a.studentName.localeCompare(b.studentName) || a.subjectName.localeCompare(b.subjectName));
  const color = studentColor(enrollments);

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
            <div className="sgrid">
              <section className="sheet text" aria-labelledby="h-text">
                <i className="magnet" style={{ "--m": "#f2b705" } as CSSProperties} aria-hidden="true" />
                <h2 id="h-text">Taille du texte</h2>
                <p className="sub">Pour lire plus facilement. Le choix est gardé sur cet appareil.</p>
                <fieldset className="chips">
                  <legend className="sr">Taille du texte</legend>
                  <div>
                    {TEXT_SCALES.map((s) => (
                      <button key={s.v} type="button" className={`chip big${scale === s.v ? " on" : ""}`} aria-pressed={scale === s.v} onClick={() => { setScale(s.v); setTextScale(s.v); }}>{s.t}</button>
                    ))}
                  </div>
                </fieldset>
                <p className="sample">Exemple : Maths avec M. Arris, chaque samedi à 12:00.</p>
              </section>

              <section className="sheet account" aria-labelledby="h-acc">
                <i className="magnet" style={{ "--m": "#d62f4b" } as CSSProperties} aria-hidden="true" />
                <h2 id="h-acc">Mon compte</h2>
                <p className="sub">Les informations de connexion.</p>
                <dl className="dl">
                  <dt>Nom</dt><dd>{user?.name}</dd>
                  <dt>E-mail</dt><dd>{user?.email}</dd>
                </dl>
              </section>
            </div>

            <section className="fiche" aria-labelledby="h-enr">
              <i className="magnet big" aria-hidden="true" />
              <h2 id="h-enr">Mes cours suivis</h2>
              <p className="sub">Pour chaque élève et matière : tous les combien de cours on paie, et le prix.</p>
              {enrollments.length === 0 && <p className="none">Aucun cours suivi pour le moment. Ajoute-en un dans la page Cours.</p>}
              <ul className="egrid">
                {enrollments.map((e) => (
                  <li key={e.id} className="prow" style={{ "--c": color(e.studentName) } as CSSProperties}>
                    <i className="gom" aria-hidden="true" />
                    <p className="stu">{e.studentName}</p>
                    <p className="l2">{e.subjectName} avec {e.teacherName}</p>
                    {(data.slots ?? []).filter((s) => s.enrollmentId === e.id).map((s) => <p key={s.id} className="note">Chaque {WEEKDAYS[s.weekday]} à {s.time}</p>)}
                    {editId === e.id ? (
                      <EnrollmentForm e={e} busy={busy} onCancel={() => setEditId(null)}
                        onSave={async (cycleSize, price) => { if (await run(() => updateEnrollment(e.id, { cycleSize, price }), "Réglages enregistrés.")) setEditId(null); }} />
                    ) : (
                      <>
                        <p className="when">On paie tous les {e.cycleSize} cours{e.price ? `, ${money(e.price)}` : ""}.</p>
                        <button className="ghost small" onClick={() => { setEditId(e.id); setNotice(""); }}>Modifier</button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <div className="sgrid">
              <section className="sheet backup" aria-labelledby="h-bak">
                <i className="magnet" style={{ "--m": "#1d9a63" } as CSSProperties} aria-hidden="true" />
                <h2 id="h-bak">Sauvegarde</h2>
                <p className="sub">Une copie de tous les élèves, cours et paiements, à garder en lieu sûr.</p>
                <button className="primary" onClick={() => downloadBackup(data)}>Télécharger une copie</button>
              </section>
              <NewYearReset data={data} onDone={load} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
