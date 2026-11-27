/* ============================================================================================
   LE CONTRAT AVEC LE BACKEND : tous les appels réseau des écrans passent par ce fichier.
   Détail de chaque route, formats JSON, règles métier et codes d'erreur : docs/API_CONTRACT.md

   GET    /enrollments          GET    /lessons         GET    /payment-cycles      GET /slots
   POST   /lessons              PATCH  /lessons/:id     DELETE /lessons/:id
   POST   /slots                DELETE /slots/:id       PATCH  /enrollments/:id
   PATCH  /payment-cycles/:id/mark-paid                 PATCH  /payment-cycles/:id/mark-unpaid
   PATCH  /enrollments/:id      POST   /reset-year        POST   /enrollments
   (+ POST /auth/register, POST /auth/login dans auth.ts)
   ============================================================================================ */
import type { DashboardData, Enrollment, EnrollmentInput, EnrollmentPatch, Lesson, LessonInput, Slot, SlotInput } from "../types";
import { req } from "./http";

const json = (body: unknown) => JSON.stringify(body);

/** Charge tout ce qu'il faut pour afficher les écrans (listes complètes de l'utilisateur connecté). */
export async function fetchDashboard(): Promise<DashboardData> {
  const [enrollments, lessons, cycles, slots] = await Promise.all([
    req<DashboardData["enrollments"]>("/enrollments"),
    req<DashboardData["lessons"]>("/lessons"),
    req<DashboardData["cycles"]>("/payment-cycles"),
    req<DashboardData["slots"]>("/slots"),
  ]);
  return { enrollments, lessons, cycles, slots };
}

/** Ajoute un cours (une séance). Si `status` = completed, le serveur la range dans un cycle. */
export async function createLesson(input: LessonInput): Promise<void> {
  await req("/lessons", { method: "POST", body: json(input) });
}

/** Crée (ou retrouve, mêmes noms) un cours suivi SANS jour de la semaine : pour un cours ponctuel avec un enseignant
    ou une matière pas encore enregistrés. Un cours suivi qui existe déjà garde son nombre de cours et son prix. */
export async function createEnrollment(input: EnrollmentInput): Promise<Enrollment> {
  return req<Enrollment>("/enrollments", { method: "POST", body: json(input) });
}

/** Cours ponctuel : avec un cours suivi déjà enregistré (`enrollmentId`), ou un nouveau (`newCourse`, 1 cours = 1 paiement). */
export async function createOneOffLesson(
  course: { enrollmentId: string } | { newCourse: Omit<EnrollmentInput, "cycleSize"> },
  lesson: Omit<LessonInput, "enrollmentId">,
): Promise<void> {
  const enrollmentId = "enrollmentId" in course ? course.enrollmentId : (await createEnrollment({ ...course.newCourse, cycleSize: 1 })).id;
  await createLesson({ enrollmentId, ...lesson });
}

/** Modifie date, statut ou notes. 409 si le cours est dans un cycle déjà payé. */
export async function updateLesson(id: string, patch: Partial<Omit<LessonInput, "enrollmentId">>): Promise<void> {
  await req(`/lessons/${id}`, { method: "PATCH", body: json(patch) });
}

/** Supprime un cours. 409 si le cours est dans un cycle déjà payé. */
export async function deleteLesson(id: string): Promise<void> {
  await req(`/lessons/${id}`, { method: "DELETE" });
}

/** Crée un cours qui se répète chaque semaine. Le serveur retrouve ou crée l'élève, la matière, l'enseignant et l'inscription. */
export async function createSlot(input: SlotInput): Promise<void> {
  await req("/slots", { method: "POST", body: json(input) });
}

/** Plusieurs jours pour le même cours (ex. lundi et jeudi) : un appel par jour, l'un après l'autre
    (le premier crée l'élève et l'inscription si besoin, les suivants les retrouvent). */
export async function createSlots(inputs: SlotInput[]): Promise<void> {
  for (const input of inputs) await createSlot(input);
}

/** Arrête un cours qui se répète : supprime ses cours prévus à venir, garde tout le passé. */
export async function deleteSlot(id: string): Promise<void> {
  await req(`/slots/${id}`, { method: "DELETE" });
}

/** Les cours passés pas encore confirmés d'un cours chaque semaine ne sont que calculés : avant de supprimer ce jour,
    on les enregistre comme vrais cours « prévus », pour qu'ils restent dans « Cours à confirmer ». */
async function keepPending(pending: Lesson[]) {
  for (const l of pending) {
    await createLesson({ enrollmentId: l.enrollmentId, date: l.date, status: "planned", slotId: l.slotId, occurrence: l.occurrence });
  }
}

/** « Arrêter ce cours » : garde les cours passés à confirmer, puis supprime le jour de la semaine. */
export async function stopSlot(id: string, pending: Lesson[]): Promise<void> {
  await keepPending(pending);
  await deleteSlot(id);
}

/** Change le jour et/ou l'heure d'un cours chaque semaine, à partir d'aujourd'hui : garde les cours passés à confirmer,
    crée le nouveau jour (même élève, matière, enseignant ; le cours suivi et ses paiements ne changent pas), puis
    supprime l'ancien. Si le nouveau jour existe déjà (409), rien n'est supprimé. */
export async function moveSlot(slot: Slot, e: Enrollment, to: { weekday: number; time: string }, pending: Lesson[]): Promise<void> {
  await keepPending(pending);
  await createSlot({ studentName: e.studentName, subjectName: e.subjectName, teacherName: e.teacherName, weekday: to.weekday, time: to.time, cycleSize: e.cycleSize, price: e.price });
  await deleteSlot(slot.id);
}

/** « Payé » : marque le cycle comme réglé en espèces (date = maintenant). */
export async function markPaid(id: string): Promise<void> {
  await req(`/payment-cycles/${id}/mark-paid`, { method: "PATCH", body: json({}) });
}

/** Correction : remet à « à payer » un cycle marqué payé par erreur (le serveur garde une trace d'audit). */
export async function markUnpaid(id: string): Promise<void> {
  await req(`/payment-cycles/${id}/mark-unpaid`, { method: "PATCH", body: json({}) });
}

/** Change le nombre de cours avant paiement et/ou le prix d'un cours suivi (le prix s'applique aux cycles non payés). */
export async function updateEnrollment(id: string, patch: EnrollmentPatch): Promise<void> {
  await req(`/enrollments/${id}`, { method: "PATCH", body: json(patch) });
}

/** « Nouvelle année » : efface toutes les données de l'utilisateur (le compte est gardé). */
export async function resetYear(): Promise<void> {
  await req("/reset-year", { method: "POST", body: json({}) });
}
