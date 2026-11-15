import { z } from "zod";

const name = (msg: string) => z.string(msg).trim().min(1, msg).max(100, msg);
const SIZE = "Le nombre de cours avant paiement doit être un nombre entier, par exemple 4.";
const PRICE = "Le prix doit être un nombre, par exemple 6000.";

export const slotCreate = z.object({
  studentName: name("Indique le prénom de l'enfant."),
  subjectName: name("Indique la matière."),
  teacherName: name("Indique le nom de l'enseignant."),
  weekday: z.number("Choisis le jour.").int("Choisis le jour.").min(0, "Choisis le jour.").max(6, "Choisis le jour."),
  time: z.string("Indique l'heure.").regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Indique l'heure."),
  // cycleSize et price ne servent qu'à créer l'inscription ; si elle existe déjà, ils sont ignorés (contrat §3).
  cycleSize: z.number(SIZE).int(SIZE).min(1, SIZE).max(50, SIZE),
  price: z.number(PRICE).int(PRICE).min(0, PRICE).max(10_000_000, PRICE).nullable().optional(),
});

export type SlotCreate = z.infer<typeof slotCreate>;
