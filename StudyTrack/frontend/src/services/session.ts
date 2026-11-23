export interface User { id: string; name: string; email: string }
export interface Session { user: User }

const SESSION_KEY = "studytrack.session";

/* Le jeton de connexion est dans un cookie httpOnly posé par le serveur : aucun script de la page ne peut le lire.
   Ici on garde seulement qui est connecté (nom, e-mail), pour l'affichage et pour savoir s'il faut aller à la connexion. */
export function getSession(): Session | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null"); } catch { return null; }
}
export const saveSession = (s: Session) => localStorage.setItem(SESSION_KEY, JSON.stringify(s));
export const logout = () => localStorage.removeItem(SESSION_KEY);
