import type { DashboardData, Enrollment, Lesson, PaymentCycle } from "../types";
import { occurrences } from "./slots";

export const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
/** Semaine du dimanche 00:00 au samedi 23:59 : elle bascule d'elle-même chaque dimanche. */
export function weekRange(now = new Date()) { const start = addDays(startOfDay(now), -now.getDay()); return { start, end: addDays(start, 7) }; }
const within = (iso: string | undefined, a: Date, b: Date) => !!iso && new Date(iso) >= a && new Date(iso) < b;

/* Affichage seulement : le serveur reste la source de vérité des cycles.
   Seules les séances « effectuées » comptent (prévues et annulées jamais).
   Paiement au premier cours : un cycle non payé est « à payer » dès sa 1re séance effectuée (date = `dueAt`). */
export function cycleProgress(c: PaymentCycle, e: Enrollment, lessons: Lesson[]) {
  const done = c.lessonIds.map((id) => lessons.find((l) => l.id === id)).filter((l): l is Lesson => l?.status === "completed");
  const dueAt = done.map((l) => l.date).sort()[0]; // date de la 1re séance du cycle : le paiement est dû ce jour-là
  return { done: Math.min(done.length, e.cycleSize), due: c.status === "unpaid" && done.length >= 1, dueAt };
}

/** Le cycle où ira la prochaine séance effectuée (même règle que le serveur, cycles/service.ts `cycleFor`) :
    le premier cycle pas plein parmi les non payés et le dernier cycle (même payé). `undefined` = un nouveau cycle. */
export function currentCycle(cycles: PaymentCycle[], e: Enrollment) {
  const mine = cycles.filter((c) => c.enrollmentId === e.id).sort((a, b) => a.number - b.number);
  const last = mine.at(-1)?.number;
  return mine.find((c) => c.lessonIds.length < e.cycleSize && (c.status === "unpaid" || c.number === last));
}

export function summarize(data: DashboardData, now = new Date()) {
  const byId = new Map(data.enrollments.map((e) => [e.id, e]));
  const week = weekRange(now);
  const tomorrow = startOfDay(addDays(now, 1));
  const amountOf = (c: PaymentCycle, e: Enrollment) => c.amount ?? e.price ?? 0;

  const due = data.cycles
    .filter((c) => c.status === "unpaid" && byId.has(c.enrollmentId))
    .map((cycle) => { const enrollment = byId.get(cycle.enrollmentId)!; return { cycle, enrollment, amount: amountOf(cycle, enrollment), ...cycleProgress(cycle, enrollment, data.lessons) }; })
    .filter((o) => o.due);
  const dueThisWeek = due.filter((o) => within(o.dueAt, week.start, week.end));
  const overdue = due.filter((o) => o.dueAt && new Date(o.dueAt) < week.start);

  /* Cours d'un jour (enregistrés + cours qui se répètent), dans l'ordre de l'heure */
  const lessonsOn = (day: Date, keep: (l: Lesson) => boolean) => [...data.lessons, ...occurrences(data.slots, data.lessons, day, addDays(day, 1))]
    .filter((l) => keep(l) && byId.has(l.enrollmentId) && within(l.date, day, addDays(day, 1)))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((lesson) => ({ lesson, enrollment: byId.get(lesson.enrollmentId)! }));
  const tomorrowLessons = lessonsOn(tomorrow, (l) => l.status === "planned");
  /* Aujourd'hui (vue téléphone) : tous les cours du jour sauf les annulés */
  const todayLessons = lessonsOn(startOfDay(now), (l) => l.status !== "cancelled");

  const paidThisWeek = data.cycles
    .filter((c) => c.status === "paid" && byId.has(c.enrollmentId) && within(c.paidAt, week.start, week.end))
    .sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""))
    .map((cycle) => { const enrollment = byId.get(cycle.enrollmentId)!; return { cycle, enrollment, amount: amountOf(cycle, enrollment) }; });

  return { week, today: startOfDay(now), todayLessons, tomorrow, tomorrowLessons, dueThisWeek, overdue, paidThisWeek, totalDue: dueThisWeek.reduce((t, o) => t + o.amount, 0) };
}

/** Une couleur fixe par élève, la même partout, pour s'y retrouver d'un coup d'œil. */
const PALETTE = ["#b3125b", "#0d5fb8", "#1b7a2f", "#c24a00", "#6a1b9a", "#00707d"];
export function studentColor(enrollments: Enrollment[]) {
  const names = [...new Set(enrollments.map((e) => e.studentName))].sort();
  return (name: string) => PALETTE[Math.max(names.indexOf(name), 0) % PALETTE.length];
}

const ORDER = { due: 0, paid: 1, next: 2 } as const;

/** Les cours suivis qui ont encore au moins un jour dans la semaine. « Arrêter ce cours » supprime le jour, mais garde
    le cours suivi sur le serveur (pour l'historique des séances et des paiements) : il n'est simplement plus « en cours ». */
export const activeEnrollmentIds = (data: DashboardData) => new Set(data.slots.map((s) => s.enrollmentId));

/** Tout ce qu'il faut pour la page Paiements (tous les cycles, sans limite de semaine). */
export function paymentsOverview(data: DashboardData) {
  const byId = new Map(data.enrollments.map((e) => [e.id, e]));
  const lessonById = new Map(data.lessons.map((l) => [l.id, l]));
  const amountOf = (c: PaymentCycle, e: Enrollment) => c.amount ?? e.price ?? 0;

  const due = data.cycles
    .filter((c) => c.status === "unpaid" && byId.has(c.enrollmentId))
    .map((cycle) => { const enrollment = byId.get(cycle.enrollmentId)!; return { cycle, enrollment, amount: amountOf(cycle, enrollment), ...cycleProgress(cycle, enrollment, data.lessons) }; })
    .filter((o) => o.due)
    .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));

  /* Pour chaque inscription, où en est le cycle en cours :
     - "paid" : déjà payé ; `remaining` cours restent avant le prochain paiement (qui se fera au cours suivant) ;
     - "due"  : commencé et pas encore payé (il est aussi dans `due`) ;
     - "next" : pas de cycle commencé ; le prochain cours effectué ouvre un cycle, à payer ce jour-là. */
  const active = activeEnrollmentIds(data);
  const ongoing = data.enrollments
    .filter((e) => active.has(e.id)) // un cours arrêté n'a plus de « prochain paiement »
    .map((enrollment) => {
      const cycle = currentCycle(data.cycles, enrollment);
      const done = cycle ? cycleProgress(cycle, enrollment, data.lessons).done : 0;
      const state: "paid" | "due" | "next" = !cycle || done === 0 ? "next" : cycle.status === "paid" ? "paid" : "due";
      return { enrollment, done, remaining: enrollment.cycleSize - done, state };
    })
    .sort((a, b) => ORDER[a.state] - ORDER[b.state] || a.remaining - b.remaining || a.enrollment.studentName.localeCompare(b.enrollment.studentName));

  const paid = data.cycles
    .filter((c) => c.status === "paid" && byId.has(c.enrollmentId))
    .sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""))
    .map((cycle) => {
      const enrollment = byId.get(cycle.enrollmentId)!;
      const lessons = cycle.lessonIds.map((id) => lessonById.get(id)).filter((l): l is Lesson => !!l).sort((a, b) => a.date.localeCompare(b.date));
      return { cycle, enrollment, amount: amountOf(cycle, enrollment), lessons, corrected: !!cycle.events?.some((e) => e.type === "unpaid") };
    });

  return { due, ongoing, paid, totalDue: due.reduce((t, o) => t + o.amount, 0), totalPaid: paid.reduce((t, o) => t + o.amount, 0) };
}

/** « En retard » : le paiement était dû (1re séance du cycle) avant le début de la semaine en cours. */
export const isOverdue = (dueAt: string | undefined, now = new Date()) => !!dueAt && new Date(dueAt) < weekRange(now).start;

/** La même phrase partout pour dire où en est un cours : « 2 cours sur 4 déjà payés… », « à payer maintenant », etc. */
export function ongoingText({ state, done, remaining, enrollment: e }: { state: "paid" | "due" | "next"; done: number; remaining: number; enrollment: Enrollment }) {
  if (state === "paid") return `${done} cours sur ${e.cycleSize} déjà payés. Encore ${remaining} cours, puis le prochain paiement (au cours suivant).`;
  if (state === "due") return `Nouveau cycle commencé (${done} cours sur ${e.cycleSize}) : à payer maintenant.`;
  return "Le prochain paiement se fera au prochain cours.";
}
