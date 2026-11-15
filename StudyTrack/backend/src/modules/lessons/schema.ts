import { z } from "zod";

const DATE = "Indique la date et l'heure du cours.";
const STATUS = "Choisis si le cours est prévu, effectué ou annulé.";
const NOTES = "Les notes sont trop longues (1000 caractères au plus).";

const status = z.enum(["planned", "completed", "cancelled"], STATUS);
const date = z.iso.datetime({ offset: true, error: DATE });
// "" ou null = pas de notes.
const notes = z.string(NOTES).trim().max(1000, NOTES).nullable().optional();

export const lessonCreate = z.object({
  enrollmentId: z.string("Ce cours suivi n'existe pas."),
  date,
  status,
  notes,
  slotId: z.string().optional(),
  occurrence: z.iso.date(DATE).optional(), // date prévue d'origine, locale AAAA-MM-JJ
}).refine((b) => (b.slotId === undefined) === (b.occurrence === undefined), DATE);

// Jamais enrollmentId, slotId ni occurrence : une séance ne change pas de cours suivi (zod retire les autres champs).
export const lessonPatch = z.object({ date: date.optional(), status: status.optional(), notes });

export type LessonCreate = z.infer<typeof lessonCreate>;
export type LessonPatch = z.infer<typeof lessonPatch>;
