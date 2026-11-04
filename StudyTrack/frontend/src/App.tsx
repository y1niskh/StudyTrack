import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import { getSession, logout } from "./services/auth";

/* Placeholder temporaire : sera remplacé à l'étape « Tableau de bord ». */
function DashboardStub() {
  const navigate = useNavigate();
  const session = getSession();
  if (!session) return <Navigate to="/connexion" replace />;
  return (
    <main style={{ padding: "2rem 1rem", maxWidth: "30rem", margin: "0 auto" }}>
      <h1>Bonjour {session.user.name}</h1>
      <p>Le tableau de bord arrive à la prochaine étape.</p>
      <button onClick={() => { logout(); navigate("/connexion"); }}>Se déconnecter</button>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardStub />} />
      <Route path="/connexion" element={<AuthPage mode="login" />} />
      <Route path="/inscription" element={<AuthPage mode="register" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
