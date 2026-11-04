export interface User { id: string; name: string; email: string }
interface AuthResult { token: string; user: User }

export class ApiError extends Error {}

const API = import.meta.env.VITE_API_URL ?? "/api";
const MOCK = import.meta.env.VITE_USE_MOCK === "true";
const SESSION_KEY = "studytrack.session";

/* ---------- Session (provisoire : localStorage) ---------- */
export function getSession(): AuthResult | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null"); } catch { return null; }
}
const saveSession = (s: AuthResult) => localStorage.setItem(SESSION_KEY, JSON.stringify(s));
export const logout = () => localStorage.removeItem(SESSION_KEY);

/* ---------- Vraie API (POST /api/auth/register | login) ---------- */
async function call(path: "register" | "login", body: object): Promise<AuthResult> {
  let res: Response;
  try {
    res = await fetch(`${API}/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Impossible de joindre le serveur. Vérifie ta connexion Internet.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.message ?? "Une erreur est survenue. Réessaie dans un instant.");
  return data as AuthResult;
}

/* ---------- Fausse API de développement (VITE_USE_MOCK=true) ---------- */
const USERS_KEY = "studytrack.mock.users";
type MockUser = User & { hash: string };
const readUsers = (): MockUser[] => JSON.parse(localStorage.getItem(USERS_KEY) ?? "[]");
async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
async function mock(path: "register" | "login", b: Record<string, string>): Promise<AuthResult> {
  await new Promise((r) => setTimeout(r, 500));
  const users = readUsers();
  const email = b.email.toLowerCase();
  const hash = await sha256(b.password);
  let found = users.find((u) => u.email === email);
  if (path === "register") {
    if (found) throw new ApiError("Un compte existe déjà avec cet e-mail. Connecte-toi plutôt.");
    found = { id: crypto.randomUUID(), name: b.name, email, hash };
    localStorage.setItem(USERS_KEY, JSON.stringify([...users, found]));
  } else if (!found || found.hash !== hash) {
    throw new ApiError("E-mail ou mot de passe incorrect.");
  }
  return { token: "mock-token", user: { id: found.id, name: found.name, email: found.email } };
}

export async function authenticate(path: "register" | "login", body: Record<string, string>) {
  const result = await (MOCK ? mock(path, body) : call(path, body));
  saveSession(result);
  return result.user;
}
