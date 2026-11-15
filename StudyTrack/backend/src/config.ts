/** Réglages lus dans l'environnement par server.ts ; les tests passent les leurs. */
export interface Config {
  jwtSecret: string;
  allowedEmails: string[]; // vide = inscriptions fermées
  secureCookies: boolean; // true en production (HTTPS)
}

/** Lit et vérifie les réglages. Renvoie un message d'erreur au lieu de démarrer avec un réglage dangereux. */
export function loadConfig(env: NodeJS.ProcessEnv): Config | string {
  const jwtSecret = env.JWT_SECRET ?? "";
  if (jwtSecret.length < 32) return "JWT_SECRET manquant ou trop court (32 caractères au moins) : voir backend/.env.example.";
  return {
    jwtSecret,
    allowedEmails: (env.ALLOWED_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
    secureCookies: env.NODE_ENV === "production",
  };
}
