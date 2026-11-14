import { getSession, logout } from "./session";

/** Erreur dont le message est écrit en français et affiché tel quel à l'utilisateur. */
export class ApiError extends Error {}

/** Racine de l'API : `/api` par défaut (voir .env.example). */
export const API = import.meta.env.VITE_API_URL ?? "/api";
/** `true` = fausse API dans le navigateur (src/services/mock.ts), pour développer sans backend. */
export const MOCK = import.meta.env.VITE_USE_MOCK === "true";

const NETWORK = "Impossible de joindre le serveur. Vérifie ta connexion Internet.";
const GENERIC = "Une erreur est survenue. Réessaie dans un instant.";

/* Seul point d'accès réseau du frontend.
   - envoie le jeton : `Authorization: Bearer <jwt>` (sauf connexion / inscription : auth = false) ;
   - erreurs : le serveur répond avec le bon code HTTP et un corps `{ "message": "texte en français" }` ;
   - 401 : jeton absent ou expiré, on efface la session et on renvoie vers la page de connexion ;
   - corps de réponse vide (ex. 204) accepté. */
export async function req<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${getSession()?.token ?? ""}` } : {}) },
    });
  } catch {
    throw new ApiError(NETWORK);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && auth) { logout(); window.location.assign("/connexion"); }
  if (!res.ok) throw new ApiError(data.message ?? GENERIC);
  return data as T;
}
