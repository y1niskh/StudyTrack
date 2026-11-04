export type AuthFields = { name: string; email: string; password: string; confirm: string };
export type AuthErrors = Partial<Record<keyof AuthFields, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MIN_PASSWORD = 8;

export function validateAuth(mode: "login" | "register", v: AuthFields): AuthErrors {
  const e: AuthErrors = {};
  if (mode === "register" && v.name.trim().length < 2) e.name = "Entre ton nom (2 caractères minimum).";
  if (!EMAIL_RE.test(v.email.trim())) e.email = "Entre une adresse e-mail valide, par exemple nom@mail.com.";
  if (!v.password) e.password = "Entre ton mot de passe.";
  else if (mode === "register" && v.password.length < MIN_PASSWORD)
    e.password = `Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.`;
  if (mode === "register" && v.confirm !== v.password) e.confirm = "Les deux mots de passe ne sont pas identiques.";
  return e;
}
