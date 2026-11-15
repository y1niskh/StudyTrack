/* Réglages d'affichage gardés dans ce navigateur (aucun rapport avec le backend). */
const KEY = "studytrack.textScale";
export const TEXT_SCALES = [{ v: 100, t: "Normal" }, { v: 115, t: "Grand" }, { v: 130, t: "Très grand" }] as const;

export function getTextScale(): number {
  const n = Number(localStorage.getItem(KEY));
  return TEXT_SCALES.some((s) => s.v === n) ? n : 100;
}
/** Tous les textes sont en `rem` : changer la taille de la racine agrandit toute l'interface d'un coup. */
export function applyTextScale(v: number) { document.documentElement.style.fontSize = `${v}%`; }
export function setTextScale(v: number) { localStorage.setItem(KEY, String(v)); applyTextScale(v); }
