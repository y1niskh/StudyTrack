/* ============================================================================================
   LE CONTRAT AVEC LE BACKEND : tous les appels réseau des écrans passent par ce fichier.
   Détail de chaque route, formats JSON, règles métier et codes d'erreur : docs/API_CONTRACT.md

   GET    /enrollments          GET    /lessons         GET    /payment-cycles      GET /slots
   POST   /lessons              PATCH  /lessons/:id     DELETE /lessons/:id
   POST   /slots                DELETE /slots/:id
   PATCH  /payment-cycles/:id/mark-paid                 PATCH  /payment-cycles/:id/mark-unpaid
   POST   /reset-year
   (+ POST /auth/register, POST /auth/login dans auth.ts)
   Avec VITE_USE_MOCK=true, chaque fonction est redirigée vers la fausse API de mock.ts.
   ============================================================================================ */
import type { DashboardData, LessonInput, SlotInput } from "../types";
import { MOCK, req } from "./http";

const mock = () => import("./mock");
const json = (body: unknown) => JSON.stringify(body);

/** Charge tout ce qu'il faut pour afficher les écrans (listes complètes de l'utilisateur connecté). */
export async function fetchDashboard(): Promise<DashboardData> {
  if (MOCK) return (await mock()).fetchDashboard();
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
  if (MOCK) return (await mock()).createLesson(input);
  await req("/lessons", { method: "POST", body: json(input) });
}

/** Modifie date, statut ou notes. 409 si le cours est dans un cycle déjà payé. */
export async function updateLesson(id: string, patch: Partial<Omit<LessonInput, "enrollmentId">>): Promise<void> {
  if (MOCK) return (await mock()).updateLesson(id, patch);
  await req(`/lessons/${id}`, { method: "PATCH", body: json(patch) });
}

/** Supprime un cours. 409 si le cours est dans un cycle déjà payé. */
export async function deleteLesson(id: string): Promise<void> {
  if (MOCK) return (await mock()).deleteLesson(id);
  await req(`/lessons/${id}`, { method: "DELETE" });
}

/** Crée un cours qui se répète chaque semaine. Le serveur retrouve ou crée l'élève, la matière, l'enseignant et l'inscription. */
export async function createSlot(input: SlotInput): Promise<void> {
  if (MOCK) return (await mock()).createSlot(input);
  await req("/slots", { method: "POST", body: json(input) });
}

/** Arrête un cours qui se répète : supprime ses cours prévus à venir, garde tout le passé. */
export async function deleteSlot(id: string): Promise<void> {
  if (MOCK) return (await mock()).deleteSlot(id);
  await req(`/slots/${id}`, { method: "DELETE" });
}

/** « Payé » : marque le cycle comme réglé en espèces (date = maintenant). */
export async function markPaid(id: string): Promise<void> {
  if (MOCK) return (await mock()).markPaid(id);
  await req(`/payment-cycles/${id}/mark-paid`, { method: "PATCH", body: json({}) });
}

/** Correction : remet à « à payer » un cycle marqué payé par erreur (le serveur garde une trace d'audit). */
export async function markUnpaid(id: string): Promise<void> {
  if (MOCK) return (await mock()).markUnpaid(id);
  await req(`/payment-cycles/${id}/mark-unpaid`, { method: "PATCH", body: json({}) });
}

/** « Nouvelle année » : efface toutes les données de l'utilisateur (le compte est gardé). */
export async function resetYear(): Promise<void> {
  if (MOCK) return (await mock()).resetYear();
  await req("/reset-year", { method: "POST", body: json({}) });
}
