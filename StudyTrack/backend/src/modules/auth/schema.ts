import { z } from "zod";

// Mêmes règles et mêmes phrases que le frontend (frontend/src/lib/validation.ts) : la personne lit le même message
// que la vérification vienne du navigateur ou du serveur.
const NAME = "Entre ton nom (2 caractères minimum).";
const EMAIL = "Entre une adresse e-mail valide, par exemple nom@mail.com.";
const PASSWORD = "Entre ton mot de passe.";

const email = z.string(EMAIL).trim().toLowerCase().pipe(z.email(EMAIL));

export const registerBody = z.object({
  name: z.string(NAME).trim().min(2, NAME).max(100, "Le nom est trop long (100 caractères au plus)."),
  email,
  // bcrypt ne lit que les 72 premiers octets : au-delà, la fin du mot de passe serait ignorée sans le dire.
  password: z.string(PASSWORD)
    .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
    .max(72, "Le mot de passe est trop long (72 caractères au plus)."),
});

export const loginBody = z.object({
  email,
  password: z.string(PASSWORD).min(1, PASSWORD).max(200, PASSWORD),
});

export type RegisterBody = z.infer<typeof registerBody>;
export type LoginBody = z.infer<typeof loginBody>;
