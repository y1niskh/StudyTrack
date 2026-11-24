import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Réglages lus dans l'environnement par server.ts ; les tests passent les leurs. */
export interface Config {
  jwtSecret: string;
  allowedEmails: string[]; // vide = inscriptions fermées
  secureCookies: boolean; // true en production (HTTPS)
  siteDir?: string; // le site construit (frontend/dist) à servir à la même adresse que l'API ; absent = API seule
}

// Chemin par défaut du site construit, à côté du dossier backend : StudyTrack/frontend/dist.
const DEFAULT_SITE = fileURLToPath(new URL("../../frontend/dist/", import.meta.url));

/** Lit et vérifie les réglages. Renvoie un message d'erreur au lieu de démarrer avec un réglage dangereux. */
export function loadConfig(env: NodeJS.ProcessEnv): Config | string {
  const jwtSecret = env.JWT_SECRET ?? "";
  if (jwtSecret.length < 32) return "JWT_SECRET manquant ou trop court (32 caractères au moins) : voir backend/.env.example.";
  return {
    jwtSecret,
    allowedEmails: (env.ALLOWED_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
    secureCookies: env.NODE_ENV === "production",
    siteDir: existsSync(DEFAULT_SITE) ? DEFAULT_SITE : undefined,
  };
}
