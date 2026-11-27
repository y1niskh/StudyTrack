import { z } from "zod";

const SIZE = "Le nombre de cours avant paiement doit être un nombre entier, par exemple 4.";
const PRICE = "Le prix doit être un nombre, par exemple 6000.";

// Messages du contrat (§3 Cours suivis). Le prix est en DA entiers ; `null` retire le prix.
export const enrollmentPatch = z.object({
  cycleSize: z.number(SIZE).int(SIZE).min(1, SIZE).max(50, SIZE).optional(),
  price: z.number(PRICE).int(PRICE).min(0, PRICE).max(10_000_000, PRICE).nullable().optional(),
});

export type EnrollmentPatch = z.infer<typeof enrollmentPatch>;

const name = (msg: string) => z.string(msg).trim().min(1, msg).max(100, msg);

/* Créer (ou retrouver) un cours suivi sans jour de la semaine : pour un cours ponctuel avec un enseignant ou une
   matière pas encore enregistrés. Mêmes messages que POST /slots. cycleSize et price ne servent qu'à la création. */
export const enrollmentCreate = z.object({
  studentName: name("Indique le prénom de l'enfant."),
  subjectName: name("Indique la matière."),
  teacherName: name("Indique le nom de l'enseignant."),
  cycleSize: z.number(SIZE).int(SIZE).min(1, SIZE).max(50, SIZE),
  price: z.number(PRICE).int(PRICE).min(0, PRICE).max(10_000_000, PRICE).nullable().optional(),
});

export type EnrollmentCreate = z.infer<typeof enrollmentCreate>;
