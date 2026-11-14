import { useState, type CSSProperties } from "react";
import type { Enrollment, PaymentCycle } from "../types";

const money = (n: number) => `${n.toLocaleString("fr-FR")} DA`;

/* Carte « à payer » : nom de l'élève, montant dessiné au stylo, bouton « Marquer comme payé » avec confirmation.
   Utilisée sur l'accueil et sur la page Paiements. `onPay` fait l'appel serveur ; la confirmation est gérée ici. */
export default function PayCard({ cycle, enrollment: e, amount, color, busy, detail, onPay }: {
  cycle: PaymentCycle; enrollment: Enrollment; amount: number; color: string; busy: boolean; detail?: string;
  onPay: (cycleId: string) => void | Promise<unknown>;
}) {
  const [asking, setAsking] = useState(false);
  return (
    <li className="item" style={{ "--c": color } as CSSProperties}>
      <div className="row">
        <p className="stu">{e.studentName}</p>
        {amount > 0 && <p className="amount">{money(amount)}</p>}
      </div>
      <p className="l2">{e.subjectName} avec {e.teacherName}</p>
      {detail && <p className="when">{detail}</p>}
      {asking ? (
        <div className="confirm" role="group" aria-label="Confirmation du paiement">
          <p>As-tu bien payé {e.teacherName} ?</p>
          <button className="primary" disabled={busy} onClick={async () => { await onPay(cycle.id); setAsking(false); }}>{busy ? "Un instant…" : "Oui, c'est payé"}</button>
          <button className="ghost" disabled={busy} onClick={() => setAsking(false)}>Non, annuler</button>
        </div>
      ) : (
        <button className="primary" onClick={() => setAsking(true)}>Marquer comme payé</button>
      )}
    </li>
  );
}
