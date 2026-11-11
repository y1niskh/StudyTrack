export type LessonStatus = "planned" | "completed" | "cancelled";

/** Inscription : un élève suit une matière avec un enseignant (noms fournis par l'API). */
export interface Enrollment {
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
}
export interface DashboardData { enrollments: Enrollment[]; lessons: Lesson[]; cycles: PaymentCycle[]; slots: Slot[] }
