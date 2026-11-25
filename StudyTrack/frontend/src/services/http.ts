import { logout } from "./session";

/** Erreur dont le message est écrit en français et affiché tel quel à l'utilisateur. */
export class ApiError extends Error {}

/** Racine de l'API : `/api` par défaut (voir .env.example). */
export const API = import.meta.env.VITE_API_URL ?? "/api";

const NETWORK = "Impossible de joindre le serveur. Vérifie ta connexion Internet.";
const GENERIC = "Une erreur est survenue. Réessaie dans un instant.";

/* Seul point d'accès réseau du frontend.
   - le jeton voyage dans le cookie httpOnly, envoyé par le navigateur lui-même (site et API à la même adresse) ;
   - toujours `Content-Type: application/json`, même sans corps : le serveur refuse toute modification sans (protection CSRF) ;
   - erreurs : le serveur répond avec le bon code HTTP et un corps `{ "message": "texte en français" }` ;
   - 401 : session absente ou expirée, on efface la session et on renvoie vers la page de connexion
     (sauf connexion / inscription, auth = false : là, 401 veut dire « mauvais mot de passe ») ;
   - corps de réponse vide (ex. 204) accepté. */
export async function req<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    throw new ApiError(NETWORK);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && auth) { logout(); window.location.assign("/connexion"); }
  if (!res.ok) throw new ApiError(data.message ?? GENERIC);
  return data as T;
}
