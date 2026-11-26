/* Logo StudyTrack : un cahier coché, puis le nom. */
export default function Logo({ large = false }: { large?: boolean }) {
  return (
    <span className={`logo${large ? " logo-lg" : ""}`}>
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <rect width="32" height="32" rx="8" fill="#315C78" />
        <path d="M10 8.5h10.5A1.5 1.5 0 0 1 22 10v13.5H11.5A1.5 1.5 0 0 1 10 22z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
        <path d="m13.5 16 2.2 2.2 4-4.4" fill="none" stroke="#E8A66A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="logo-name">StudyTrack</span>
    </span>
  );
}
