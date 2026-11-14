import { NavLink, useNavigate } from "react-router-dom";
import { getSession, logout } from "../services/auth";
import Brand from "./Brand";
import "./Header.css";

const LINKS = [{ to: "/", label: "Accueil" }, { to: "/cours", label: "Cours" }, { to: "/paiements", label: "Paiements" }];

/* En-tête commun : titre aimanté, menu, bonjour et déconnexion. */
export default function Header() {
  const navigate = useNavigate();
  return (
    <header className="topbar">
      <Brand small />
      <div className="who">
        <p className="hello">Bonjour {getSession()?.user.name} !</p>
        <button className="magnet-btn" onClick={() => { logout(); navigate("/connexion"); }}>
          <svg className="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9" /></svg> Se déconnecter
        </button>
      </div>
      <nav className="nav" aria-label="Menu">
        {LINKS.map((l) => <NavLink key={l.to} to={l.to} end>{l.label}</NavLink>)}
      </nav>
    </header>
  );
}
