import { useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { getSession, signOut } from "../services/auth";
import Brand from "./Brand";
import "./Header.css";

/* `short` : libellé de la barre du bas sur téléphone (place limitée) ; `title` : titre de la page sur téléphone. */
const LINKS = [
  { to: "/", label: "Accueil", short: "Accueil", title: "", icon: "M4 11l8-7 8 7M6 9.5V20h4.5v-5h3v5H18V9.5" },
  { to: "/cours", label: "Cours", short: "Cours", title: "Les cours", icon: "M4 6h16v14H4zM4 10h16M9 3v5M15 3v5" },
  { to: "/paiements", label: "Paiements", short: "Paiements", title: "Paiements", icon: "M3 7h18v11H3zM3 11h18M7 15h3" },
  { to: "/parametres", label: "Paramètres", short: "Réglages", title: "Réglages", icon: "M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4" },
];

/* En-tête commun : titre aimanté, menu, bonjour et déconnexion.
   Sur téléphone (moins de 760 px) : le menu du haut est remplacé par une barre fixe en bas de l'écran,
   et le titre de la page remplace le « Bonjour » sauf sur l'accueil. */
export default function Header() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const title = LINKS.find((l) => l.to === pathname)?.title ?? "";
  /* Chaque page s'ouvre en haut (sinon on garde la position de la page précédente, surtout gênant sur téléphone) */
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <>
      <header className="topbar" data-home={title === ""}>
        <Brand small />
        <div className="who">
          <p className="hello">Bonjour {getSession()?.user.name} !</p>
          {title && <p className="m-title" aria-hidden="true">{title}</p>}
          <button className="magnet-btn logout" onClick={async () => { await signOut(); navigate("/connexion"); }}>
            <svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9" /></svg> <span className="logout-t">Se déconnecter</span>
          </button>
        </div>
        <nav className="nav" aria-label="Menu">
          {LINKS.map((l) => <NavLink key={l.to} to={l.to} end>{l.label}</NavLink>)}
        </nav>
      </header>
      <nav className="tabbar" aria-label="Menu principal">
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end>
            <svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d={l.icon} /></svg>
            <span>{l.short}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
