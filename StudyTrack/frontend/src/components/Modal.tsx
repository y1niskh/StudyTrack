import { useEffect, useId, useRef, type ReactNode } from "react";

/* Fenêtre au-dessus de la page (élément <dialog> natif : la touche Échap ferme, le focus reste dedans).
   Le contenu n'existe que pendant que la fenêtre est ouverte : un formulaire repart toujours de zéro. */
export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="modal" aria-labelledby={id} onClose={onClose} onCancel={(e) => { e.preventDefault(); onClose(); }}>
      {open && (
        <>
          <div className="modal-head">
            <h2 id={id}>{title}</h2>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Fermer</button>
          </div>
          <div className="modal-body">{children}</div>
        </>
      )}
    </dialog>
  );
}

/* Demande de confirmation avant une action importante (payer, supprimer, effacer…). */
export function Confirm({ open, title, children, confirmLabel, cancelLabel = "Annuler", tone = "primary", busy, onConfirm, onCancel, extra }: {
  open: boolean; title: string; children: ReactNode; confirmLabel: string; cancelLabel?: string; tone?: "primary" | "danger" | "success";
  busy: boolean; onConfirm: () => void; onCancel: () => void; extra?: ReactNode;
}) {
  return (
    <Modal open={open} title={title} onClose={() => { if (!busy) onCancel(); }}>
      <div className="modal-text">{children}</div>
      {extra}
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>{cancelLabel}</button>
        <button type="button" className={`btn btn-${tone}`} disabled={busy} onClick={onConfirm}>{busy ? "Un instant…" : confirmLabel}</button>
      </div>
    </Modal>
  );
}
