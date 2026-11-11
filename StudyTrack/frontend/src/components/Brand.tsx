const LETTERS = "StudyTrack".split("");

/* Titre en lettres aimantées */
export default function Brand({ small = false }: { small?: boolean }) {
  return (
    <h1 className={`brand${small ? " brand--sm" : ""}`} aria-label="StudyTrack">
      {LETTERS.map((l, i) => <span key={i} aria-hidden="true" className={`tile t${i % 5}`}>{l}</span>)}
    </h1>
  );
}
