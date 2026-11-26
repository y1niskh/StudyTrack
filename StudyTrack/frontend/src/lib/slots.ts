import type { DashboardData, Lesson, Slot } from "../types";
import { dayKey } from "./lessons";

export const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
export const isVirtual = (id: string) => id.startsWith("v:");

/* Les cours qui se répètent ne sont pas copiés un par un : on les calcule à l'affichage pour n'importe quelle période.
   Un cours « virtuel » devient un vrai cours (enregistré) seulement quand on le confirme, l'annule ou le modifie.
   Un cours déjà enregistré pour la même date d'origine remplace le virtuel (jamais de doublon). */
export function occurrences(slots: Slot[], lessons: Lesson[], from: Date, to: Date): Lesson[] {
  const taken = new Set(lessons.filter((l) => l.slotId).map((l) => `${l.slotId}|${l.occurrence ?? dayKey(l.date)}`));
  const out: Lesson[] = [];
  for (const s of slots) {
    for (let d = new Date(from.getFullYear(), from.getMonth(), from.getDate()); d < to; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const k = dayKey(d);
      if (d.getDay() !== s.weekday || k < s.since || taken.has(`${s.id}|${k}`)) continue;
      out.push({ id: `v:${s.id}:${k}`, enrollmentId: s.enrollmentId, date: new Date(`${k}T${s.time}`).toISOString(), status: "planned", slotId: s.id, occurrence: k });
    }
  }
  return out;
}

/** Cours à confirmer : prévus, dont l'heure est passée, pas encore marqués « fait » ou « annulé » (du plus ancien au plus récent). */
export function lessonsToConfirm(data: DashboardData, now: Date): Lesson[] {
  const known = new Set(data.enrollments.map((e) => e.id));
  const since = data.slots.map((s) => new Date(`${s.since}T00:00`)).sort((a, b) => +a - +b)[0] ?? now;
  return [...data.lessons, ...occurrences(data.slots, data.lessons, since, now)]
    .filter((l) => l.status === "planned" && new Date(l.date) < now && known.has(l.enrollmentId))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Amène directement une section en haut de l'écran (saut immédiat : rien ne bouge pendant qu'on lit). */
export function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ block: "start" });
}
