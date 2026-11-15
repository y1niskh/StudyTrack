import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import LessonsPage from "./pages/LessonsPage";
import PaymentsPage from "./pages/PaymentsPage";
import SettingsPage from "./pages/SettingsPage";
import { getSession } from "./services/auth";

function Protected({ children }: { children: ReactNode }) {
  return getSession() ? children : <Navigate to="/connexion" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/cours" element={<Protected><LessonsPage /></Protected>} />
      <Route path="/paiements" element={<Protected><PaymentsPage /></Protected>} />
      <Route path="/parametres" element={<Protected><SettingsPage /></Protected>} />
      <Route path="/connexion" element={<AuthPage mode="login" />} />
      <Route path="/inscription" element={<AuthPage mode="register" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
