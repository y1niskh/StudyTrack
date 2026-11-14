export interface User { id: string; name: string; email: string }
export interface AuthResult { token: string; user: User }

const SESSION_KEY = "studytrack.session";

/* Session : le jeton JWT renvoyé par le serveur est gardé dans le localStorage.
   (Choix provisoire : un cookie httpOnly posé par le serveur serait plus sûr contre le vol de jeton, à décider avec le backend.) */
export function getSession(): AuthResult | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null"); } catch { return null; }
}
export const saveSession = (s: AuthResult) => localStorage.setItem(SESSION_KEY, JSON.stringify(s));
export const logout = () => localStorage.removeItem(SESSION_KEY);
