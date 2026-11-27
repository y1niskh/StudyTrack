/* Formes JSON échangées avec l'API (détail : docs/API_CONTRACT.md).
   - Les identifiants sont des chaînes nommées `id` (le backend Mongoose doit renvoyer `id`, pas `_id`).
   - Les dates/heures sont des chaînes ISO 8601 en UTC (ex. "2026-11-14T11:00:00.000Z"), sauf `Slot.since` et
     `Lesson.occurrence` qui sont des dates locales "AAAA-MM-JJ", et `Slot.time` qui est une heure locale "HH:MM".
   - Un Enrollment est renvoyé « à plat » : avec les noms de l'élève, de l'enseignant et de la matière déjà remplis. */
export type LessonStatus = "planned" | "completed" | "cancelled";

/** Inscription : un élève suit une matière avec un enseignant (noms fournis par l'API). */
export interface Enrollment {
  // Le serveur peut ajouter studentId / teacherId / subjectId / active : le frontend ne s'en sert pas encore.
  id: string; studentName: string; teacherName: string; subjectName: string;
  cycleSize: number; price?: number; // prix indicatif par cycle, en DA
}
/** Cours qui se répète chaque semaine : « Maths avec M. Arris, chaque samedi à 12:00 ». */
export interface Slot { id: string; enrollmentId: string; weekday: number; time: string; since: string } // weekday : 0 = dimanche … 6 = samedi ; since = AAAA-MM-JJ
export interface Lesson {
  id: string; enrollmentId: string; date: string; status: LessonStatus; notes?: string;
  slotId?: string; occurrence?: string; // si le cours vient d'un cours qui se répète : lequel, et la date prévue d'origine (AAAA-MM-JJ)
}
export interface LessonInput { enrollmentId: string; date: string; status: LessonStatus; notes?: string; slotId?: string; occurrence?: string }
export interface SlotInput { studentName: string; subjectName: string; teacherName: string; weekday: number; time: string; cycleSize: number; price?: number }
export interface PaymentCycle {
  id: string; enrollmentId: string; number: number; lessonIds: string[];
  amount?: number; status: "unpaid" | "paid"; paidAt?: string;
  /** Trace d'audit, ajoutée à chaque changement (jamais effacée) : « payé » ou « remis à payer » (correction d'une erreur). */
  events?: { type: "paid" | "unpaid"; at: string }[];
}
export interface DashboardData { enrollments: Enrollment[]; lessons: Lesson[]; cycles: PaymentCycle[]; slots: Slot[] }

/** Créer (ou retrouver) un cours suivi sans jour de la semaine (cours ponctuel). */
export interface EnrollmentInput { studentName: string; subjectName: string; teacherName: string; cycleSize: number; price?: number }

/** Modification d'un cours suivi. `price: null` retire le prix. */
export interface EnrollmentPatch { cycleSize?: number; price?: number | null }
