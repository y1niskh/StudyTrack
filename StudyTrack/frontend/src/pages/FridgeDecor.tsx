import type { CSSProperties } from "react";

/* Décor de la porte : poignée, joint, aimants et post-its. Purement visuel. */
const NOTES = [
  { id: "n1", p: "#ffb3c7", m: "#d62f4b", ink: "#1b3a8a", text: "Maths\nmardi 17h" },
  { id: "n2", p: "#9fd8ff", m: "#f2b705", ink: "#222", text: "Cours annulé,\nça ne compte\npas !" },
  { id: "n3", p: "#ffcf8f", m: "#2f7de1", ink: "#b3261e", text: "Payer le prof\nquand le cycle\nest plein ✔" },
  { id: "n4", p: "#d9c8ff", m: "#1d9a63", ink: "#222", text: "Lait, œufs,\npain" },
  { id: "n5", p: "#c2eba0", m: "#e8590c", ink: "#1b3a8a", text: "Physique\njeudi 16h" },
  { id: "n6", p: "#9be8d8", m: "#d62f4b", ink: "#222", text: "Anglais\nlundi 18h" },
  { id: "n7", p: "#ff9e8f", m: "#2f7de1", ink: "#1b3a8a", text: "Apporter le\ncahier de\nmaths !" },
  { id: "n8", p: "#f3f0a0", m: "#8e44ad", ink: "#b3261e", text: "4 séances\n= 1 paiement" },
  { id: "n9", p: "#b8c8ff", m: "#f2b705", ink: "#222", text: "Appeler le prof\nde français" },
  { id: "n10", p: "#ffc2e8", m: "#1d9a63", ink: "#1b3a8a", text: "N'oublie pas\nde cocher\n« Payé » !" },
];

const W = { stroke: "#fff", strokeWidth: 3, strokeLinejoin: "round" as const };
const FRUITS = [
  <svg key="s" viewBox="0 0 48 48"><path d="M24 43C9 35 7 20 12 15c6-5 18-5 24 0 5 5 3 20-12 28Z" fill="#e63946" {...W} /><path d="M13 14l11-5 11 5-7 2-4-3-4 3Z" fill="#2f9e44" /><g fill="#ffe08a"><ellipse cx="18" cy="23" rx="1.3" ry="2" /><ellipse cx="28" cy="22" rx="1.3" ry="2" /><ellipse cx="23" cy="30" rx="1.3" ry="2" /><ellipse cx="31" cy="30" rx="1.3" ry="2" /></g></svg>,
  <svg key="l" viewBox="0 0 48 48"><circle cx="24" cy="24" r="19" fill="#ffd43b" {...W} /><circle cx="24" cy="24" r="14" fill="#fff4a8" /><path d="M24 10v28M10 24h28M14 14l20 20M34 14 14 34" stroke="#f2b705" strokeWidth="1.5" /></svg>,
  <svg key="h" viewBox="0 0 48 48"><path d="M24 41C6 29 8 12 18 11c4 0 6 3 6 5 0-2 2-5 6-5 10 1 12 18-6 30Z" fill="#ff5c8a" {...W} /></svg>,
  <svg key="t" viewBox="0 0 48 48"><path d="m24 5 5 13h14l-11 9 4 14-12-9-12 9 4-14L5 18h14Z" fill="#ffc400" {...W} /></svg>,
];

export default function FridgeDecor() {
  return (
    <div className="decor" aria-hidden="true">
      <i className="seam" />
      <i className="handle" />
      <i className="smudge s1" /><i className="smudge s2" />
      {FRUITS.map((f, i) => <span key={i} className={`fruit f${i + 1}`}>{f}</span>)}
      {NOTES.map((n) => (
        <p key={n.id} className={`postit ${n.id}`} style={{ "--p": n.p, "--ink": n.ink } as CSSProperties}>
          <i className="magnet" style={{ "--m": n.m } as CSSProperties} />
          {n.text}
        </p>
      ))}
    </div>
  );
}
