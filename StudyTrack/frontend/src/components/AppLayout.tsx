import { useEffect, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { getSession, signOut } from "../services/auth";
import Icon, { type IconName } from "./Icon";
import Logo from "./Logo";
import "./AppLayout.css";

const LINKS: { to: string; label: string; icon: IconName }[] = [
  { to: "/", label: "Accueil", icon: "home" },
  { to: "/eleves", label: "Élèves", icon: "users" },
  { to: "/cours", label: "Cours", icon: "calendar" },
  { to: "/paiements", label: "Paiements", icon: "wallet" },
  { to: "/parametres", label: "Réglages", icon: "settings" },
];

/* Cadre commun à toutes les pages connectées.
   Ordinateur et tablette (760 px et plus) : barre latérale fixe (logo, rubriques, profil en bas).
   Téléphone : bandeau en haut (logo + déconnexion) et rubriques en bas de l'écran, à portée du pouce. */
export default function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const user = getSession()?.user;
  /* Chaque page s'ouvre en haut */
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  const logout = async () => { await signOut(); navigate("/connexion"); };
  const links = LINKS.map((l) => (
    <NavLink key={l.to} to={l.to} end={l.to === "/"}>
      <Icon n={l.icon} /><span>{l.label}</span>
    </NavLink>
  ));

  return (
    <div className="shell">
      <a className="skip" href="#contenu">Aller au contenu</a>
      <aside className="sidebar">
        <Logo />
        <nav className="side-nav" aria-label="Menu">{links}</nav>
        <div className="profile">
          <span className="profile-ava" aria-hidden="true">{user?.name?.charAt(0).toUpperCase()}</span>
          <span className="profile-text"><strong>{user?.name}</strong><span>{user?.email}</span></span>
          <button type="button" className="btn btn-secondary btn-sm btn-block" onClick={() => void logout()}><Icon n="logout" /> Se déconnecter</button>
        </div>
      </aside>

      <header className="mobilebar">
        <Logo />
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void logout()}><Icon n="logout" /> Se déconnecter</button>
      </header>

      <main id="contenu" className="content" tabIndex={-1}>{children}</main>

      <nav className="tabbar" aria-label="Menu principal">{links}</nav>
    </div>
  );
}
