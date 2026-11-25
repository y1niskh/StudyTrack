import { req } from "./http";
import { logout, saveSession, type Session } from "./session";

export { ApiError } from "./http";
export { getSession, type User } from "./session";

/** POST /api/auth/register  { name, email, password }  ou  POST /api/auth/login  { email, password }
    Réponse : { user: { id, name, email } } ; le jeton arrive dans un cookie httpOnly (voir docs/API_CONTRACT.md). */
export async function authenticate(path: "register" | "login", body: Record<string, string>) {
  const result = await req<Session>(`/auth/${path}`, { method: "POST", body: JSON.stringify(body) }, false);
  saveSession({ user: result.user });
  return result.user;
}

/** Se déconnecter : le serveur invalide tous les jetons de ce compte (téléphone et ordinateur) et efface le cookie.
    Même sans réseau, on oublie la session dans ce navigateur. */
export async function signOut() {
  await req("/auth/logout", { method: "POST", body: "{}" }, false).catch(() => {});
  logout();
}
