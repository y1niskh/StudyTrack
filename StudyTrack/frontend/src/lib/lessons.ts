import type { LessonStatus } from "../types";

const pad = (n: number) => String(n).padStart(2, "0");
export const dayKey = (d: Date | string) => { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
export const monthKey = (d: Date | string) => dayKey(d).slice(0, 7);
export const timeOf = (d: Date | string) => { const x = new Date(d); return `${pad(x.getHours())}:${pad(x.getMinutes())}`; };
export const toISO = (date: string, time: string) => new Date(`${date}T${time}`).toISOString();
export const STATUS_LABEL: Record<LessonStatus, string> = { planned: "Prévu", completed: "Fait", cancelled: "Annulé" };
