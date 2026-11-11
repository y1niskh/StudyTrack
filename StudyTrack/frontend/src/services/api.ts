import { dayKey } from "../lib/lessons";
import type { DashboardData, LessonInput, LessonStatus, Slot, SlotInput } from "../types";
import { ApiError, getSession } from "./auth";

const API = import.meta.env.VITE_API_URL ?? "/api";
const MOCK = import.meta.env.VITE_USE_MOCK === "true";

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getSession()?.token ?? ""}` },
    });
  } catch {
    throw new ApiError("Impossible de joindre le serveur. Vérifie ta connexion Internet.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.message ?? "Une erreur est survenue. Réessaie dans un instant.");
  return data as T;
}

/* ---------- Fausse API de développement (VITE_USE_MOCK=true) ---------- */
const KEY = "studytrack.mock.data.v3";
const day = (offset: number, h = 17) => { const d = new Date(); d.setDate(d.getDate() + offset); d.setHours(h, 0, 0, 0); return d.toISOString(); };

function seed(): DashboardData {
  const enrollments = [
    { id: "e1", studentName: "Sara", teacherName: "M. Benali", subjectName: "Maths", cycleSize: 4, price: 6000 },
    { id: "e2", studentName: "Sara", teacherName: "Mme Amrani", subjectName: "Physique", cycleSize: 8, price: 12000 },
    { id: "e3", studentName: "Yacine", teacherName: "Mme Khelifi", subjectName: "Anglais", cycleSize: 4, price: 5000 },
    { id: "e4", studentName: "Yacine", teacherName: "M. Benali", subjectName: "Maths", cycleSize: 4, price: 6000 },
  ];
  const lessons: DashboardData["lessons"] = []; const cycles: DashboardData["cycles"] = [];
  const add = (enr: string, offset: number, status: LessonStatus, h = 17) => {
    const id = `l${lessons.length + 1}`; lessons.push({ id, enrollmentId: enr, date: day(offset, h), status }); return id;
  };
  const done = (enr: string, from: number, n: number) => Array.from({ length: n }, (_, i) => add(enr, from + i * 7, "completed"));
  const cyc = (enr: string, number: number, lessonIds: string[], status: "paid" | "unpaid", amount: number, paidAt?: string) =>
    cycles.push({ id: `c${cycles.length + 1}`, enrollmentId: enr, number, lessonIds, status, amount, paidAt });
  cyc("e1", 1, done("e1", -70, 4), "paid", 6000, day(-40));
  cyc("e1", 2, [...done("e1", -21, 3), add("e1", 0, "completed", 8)], "unpaid", 6000); // complet cette semaine
  add("e1", -3, "cancelled");
  cyc("e2", 1, done("e2", -35, 5), "unpaid", 12000); 
  cyc("e3", 1, done("e3", -45, 4), "paid", 5000, day(0, 7)); cyc("e3", 2, done("e3", -14, 2), "unpaid", 5000); 
  cyc("e4", 1, [...done("e4", -36, 3), add("e4", -8, "completed")], "unpaid", 6000); // en retard : semaine passée
  add("e4", -2, "cancelled");
  // Cours qui se répètent chaque semaine (début : il y a 5 jours, pour montrer « à confirmer »)
  const slot = (id: string, enr: string, offset: number, time: string) => ({ id, enrollmentId: enr, weekday: new Date(day(offset)).getDay(), time, since: dayKey(day(-5)) });
  const slots: Slot[] = [slot("s1", "e1", 1, "17:00"), slot("s2", "e2", 1, "16:00"), slot("s3", "e2", 4, "16:00"), slot("s4", "e3", 3, "18:00"), slot("s5", "e4", 5, "15:00")];
  return { enrollments, lessons, cycles, slots };
}
const load = (): DashboardData => { const d: DashboardData = JSON.parse(localStorage.getItem(KEY) ?? "null") ?? seed(); d.slots ??= []; return d; };
const save = (d: DashboardData) => localStorage.setItem(KEY, JSON.stringify(d));

async function mockMarkPaid(id: string) {
  await new Promise((r) => setTimeout(r, 400));
  const data = load(); const c = data.cycles.find((x) => x.id === id);
  if (!c || c.status === "paid") throw new ApiError("Ce cycle est déjà marqué comme payé.");
  c.status = "paid"; c.paidAt = new Date().toISOString();
  data.cycles.push({ id: `c${data.cycles.length + 1}`, enrollmentId: c.enrollmentId, number: c.number + 1, lessonIds: [], amount: c.amount, status: "unpaid" });
  save(data);
}

/* Règles de cycle (le vrai serveur les appliquera aussi) :
   - seule une séance « effectuée » entre dans un cycle, jamais deux fois ;
   - elle rejoint le premier cycle non payé qui n'est pas plein (un cycle se remplit dans l'ordre, même pour un ajout rétroactif) ;
   - un cours déjà compris dans un cycle PAYÉ est verrouillé : on ne le modifie ni ne le supprime. */
const LOCKED = "Ce cours fait partie d'un cycle déjà payé : il ne peut plus être modifié.";
const cycleOf = (d: DashboardData, lessonId: string) => d.cycles.find((c) => c.lessonIds.includes(lessonId));
function attach(d: DashboardData, lessonId: string, enrollmentId: string) {
  const e = d.enrollments.find((x) => x.id === enrollmentId);
  if (!e) throw new ApiError("Ce cours suivi n'existe pas.");
  const mine = d.cycles.filter((c) => c.enrollmentId === e.id);
  let c = mine.filter((x) => x.status === "unpaid" && x.lessonIds.length < e.cycleSize).sort((a, b) => a.number - b.number)[0];
  if (!c) {
    c = { id: `c${Date.now()}`, enrollmentId: e.id, number: Math.max(0, ...mine.map((x) => x.number)) + 1, lessonIds: [], amount: e.price, status: "unpaid" };
    d.cycles.push(c);
  }
  c.lessonIds.push(lessonId);
}
function detach(d: DashboardData, lessonId: string) {
  const c = cycleOf(d, lessonId);
  if (c) c.lessonIds = c.lessonIds.filter((id) => id !== lessonId);
}
const lessonCall = async <T,>(real: () => Promise<T>, mock: (d: DashboardData) => void) => {
  if (!MOCK) return real();
  await new Promise((r) => setTimeout(r, 300));
  const d = load(); mock(d); save(d);
};

export const createLesson = (input: LessonInput) =>
  lessonCall(() => req("/lessons", { method: "POST", body: JSON.stringify(input) }), (d) => {
    const l = { id: `l${Date.now()}`, ...input }; d.lessons.push(l);
    if (l.status === "completed") attach(d, l.id, l.enrollmentId);
  });

export const updateLesson = (id: string, patch: Partial<Omit<LessonInput, "enrollmentId">>) =>
  lessonCall(() => req(`/lessons/${id}`, { method: "PATCH", body: JSON.stringify(patch) }), (d) => {
    const l = d.lessons.find((x) => x.id === id); if (!l) throw new ApiError("Ce cours n'existe plus.");
    if (cycleOf(d, id)?.status === "paid") throw new ApiError(LOCKED);
    const was = l.status; Object.assign(l, patch);
    if (was === "completed" && l.status !== "completed") detach(d, id);
    if (was !== "completed" && l.status === "completed") attach(d, id, l.enrollmentId);
  });

export const deleteLesson = (id: string) =>
  lessonCall(() => req(`/lessons/${id}`, { method: "DELETE" }), (d) => {
    if (cycleOf(d, id)?.status === "paid") throw new ApiError(LOCKED);
    detach(d, id); d.lessons = d.lessons.filter((x) => x.id !== id);
  });

/* Cours qui se répètent : l'élève, la matière et l'enseignant sont écrits une seule fois.
   Le cours suivi (inscription) est retrouvé par ses noms, sinon il est créé avec son nombre de cours par cycle. */
export const createSlot = (input: SlotInput) =>
  lessonCall(() => req("/slots", { method: "POST", body: JSON.stringify(input) }), (d) => {
    const n = (t: string) => t.trim().toLowerCase();
    let e = d.enrollments.find((x) => n(x.studentName) === n(input.studentName) && n(x.subjectName) === n(input.subjectName) && n(x.teacherName) === n(input.teacherName));
    if (!e) {
      e = { id: `e${Date.now()}`, studentName: input.studentName.trim(), subjectName: input.subjectName.trim(), teacherName: input.teacherName.trim(), cycleSize: input.cycleSize, price: input.price };
      d.enrollments.push(e);
    }
    if (d.slots.some((s) => s.enrollmentId === e.id && s.weekday === input.weekday && s.time === input.time)) throw new ApiError("Ce cours existe déjà à ce jour et à cette heure.");
    d.slots.push({ id: `s${Date.now()}`, enrollmentId: e.id, weekday: input.weekday, time: input.time, since: dayKey(new Date()) });
  });

/** Arrêter un cours qui se répète : les cours à venir disparaissent, ceux déjà passés ou confirmés sont gardés. */
export const deleteSlot = (id: string) =>
  lessonCall(() => req(`/slots/${id}`, { method: "DELETE" }), (d) => {
    d.slots = d.slots.filter((s) => s.id !== id);
    const now = new Date().toISOString(); d.lessons = d.lessons.filter((l) => !(l.slotId === id && l.status === "planned" && l.date > now));
  });

/** « Nouvelle année » : efface élèves, enseignants, matières, cours et paiements. */
export async function resetYear() {
  if (!MOCK) return req("/reset-year", { method: "POST", body: "{}" });
  await new Promise((r) => setTimeout(r, 400));
  save({ enrollments: [], lessons: [], cycles: [], slots: [] });
}

export async function fetchDashboard(): Promise<DashboardData> {
  if (MOCK) { await new Promise((r) => setTimeout(r, 300)); const d = load(); save(d); return d; }
  const [enrollments, lessons, cycles] = await Promise.all([
    req<DashboardData["enrollments"]>("/enrollments"), req<DashboardData["lessons"]>("/lessons"), req<DashboardData["cycles"]>("/payment-cycles"),
  ]);
  // Cours qui se répètent chaque semaine (début : il y a 5 jours, pour montrer « à confirmer »)
  const slot = (id: string, enr: string, offset: number, time: string) => ({ id, enrollmentId: enr, weekday: new Date(day(offset)).getDay(), time, since: dayKey(day(-5)) });
  const slots: Slot[] = [slot("s1", "e1", 1, "17:00"), slot("s2", "e2", 1, "16:00"), slot("s3", "e2", 4, "16:00"), slot("s4", "e3", 3, "18:00"), slot("s5", "e4", 5, "15:00")];
  return { enrollments, lessons, cycles, slots };
}
export const markPaid = (id: string) => (MOCK ? mockMarkPaid(id) : req(`/payment-cycles/${id}/mark-paid`, { method: "PATCH", body: "{}" }));
