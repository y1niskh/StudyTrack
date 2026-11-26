import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import Icon from "../components/Icon";
import NewYearReset from "../components/NewYearReset";
import { PageHeader, PageMessages } from "../components/ui";
import { downloadBackup } from "../lib/backup";
import { getTextScale, setTextScale, TEXT_SCALES } from "../lib/prefs";
import { useAppData } from "../lib/useAppData";
import { getSession, signOut } from "../services/auth";
import "./SettingsPage.css";

export default function SettingsPage() {
  const { data, error, notice, load, clearNotice, clearError } = useAppData();
  const [scale, setScale] = useState(getTextScale);
  const [saved, setSaved] = useState("");
  const user = getSession()?.user;
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="page settings">
        <PageHeader title="Réglages" sub="Affichage, compte, sauvegarde et nouvelle année." />
        <PageMessages loaded={!!data} error={error} notice={notice || saved} onRetry={() => void load()} onCloseError={clearError} onCloseNotice={() => { clearNotice(); setSaved(""); }} />

        <div className="grid-2">
          <section className="card" aria-labelledby="h-text">
            <div className="card-head"><h2 id="h-text">Taille du texte</h2><p className="card-sub">Pour lire plus facilement. Le choix est gardé sur cet appareil.</p></div>
            <div className="card-body">
              <div className="choices" role="group" aria-label="Taille du texte">
                {TEXT_SCALES.map((s) => (
                  <button key={s.v} type="button" className="pill" aria-pressed={scale === s.v}
                    onClick={() => { setScale(s.v); setTextScale(s.v); setSaved(`Taille du texte : ${s.t}.`); }}>{s.t}</button>
                ))}
              </div>
              <p className="sample">Exemple : Maths avec M. Arris, chaque samedi à 12:00.</p>
            </div>
          </section>

          <section className="card" aria-labelledby="h-acc">
            <div className="card-head"><h2 id="h-acc">Mon compte</h2><p className="card-sub">Les informations de connexion.</p></div>
            <div className="card-body">
              <dl className="dl">
                <div><dt>Nom</dt><dd>{user?.name}</dd></div>
                <div><dt>Adresse e-mail</dt><dd>{user?.email}</dd></div>
              </dl>
              <button type="button" className="btn btn-secondary" onClick={async () => { await signOut(); navigate("/connexion"); }}><Icon n="logout" /> Se déconnecter</button>
            </div>
          </section>

          <section className="card" aria-labelledby="h-price">
            <div className="card-head"><h2 id="h-price">Prix et nombre de cours</h2></div>
            <div className="card-body">
              <p className="card-text">Le prix d'un paiement et le nombre de cours avant de payer se modifient dans la fiche de chaque élève, matière par matière.</p>
              <Link className="btn btn-secondary" to="/eleves"><Icon n="users" /> Voir les élèves</Link>
            </div>
          </section>

          <section className="card" aria-labelledby="h-bak">
            <div className="card-head"><h2 id="h-bak">Sauvegarde</h2></div>
            <div className="card-body">
              <p className="card-text">Une copie de tous les élèves, cours et paiements dans un fichier, à garder en lieu sûr.</p>
              <button type="button" className="btn btn-primary" disabled={!data} onClick={() => { downloadBackup(data); setSaved("La copie a été téléchargée (dossier Téléchargements)."); }}><Icon n="download" /> Télécharger une copie</button>
            </div>
          </section>
        </div>

        {data && <NewYearReset data={data} onDone={load} />}
      </div>
    </AppLayout>
  );
}
