import { useState } from "react";
import { isOverdue } from "../lib/cycles";
import { money } from "../lib/useAppData";
import type { Enrollment, PaymentCycle } from "../types";
import Icon from "./Icon";
import { Confirm } from "./Modal";
import { Avatar, Badge } from "./ui";

/* Une ligne « à payer » : élève, matière, montant, statut écrit (« En retard » ou « À payer »),
   bouton « Marquer comme payé » qui demande confirmation. Utilisée sur l'Accueil, la fiche élève et la page Paiements. */
export default function PaymentItem({ cycle, enrollment: e, amount, doneAt, color, busy, detail, onPay }: {
  cycle: PaymentCycle; enrollment: Enrollment; amount: number; doneAt?: string; color: string; busy: boolean; detail?: string;
  onPay: (cycleId: string) => Promise<boolean>;
}) {
  const [asking, setAsking] = useState(false);
  const late = isOverdue(doneAt);
  return (
    <li className="row">
      <div className="row-main">
        <Avatar name={e.studentName} color={color} />
        <div className="row-text">
          <p className="row-title">{e.studentName}</p>
          <p className="row-sub">{e.subjectName} avec {e.teacherName}</p>
          {detail && <p className="row-sub">{detail}</p>}
        </div>
      </div>
      <div className="row-meta">
        {late ? <Badge tone="danger">En retard</Badge> : <Badge tone="warning">À payer</Badge>}
        {amount > 0 && <span className="amount">{money(amount)}</span>}
      </div>
      <div className="row-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setAsking(true)}><Icon n="check" /> Marquer comme payé</button>
      </div>
      <Confirm open={asking} title="Confirmer le paiement" confirmLabel="Oui, c'est payé" tone="success" busy={busy}
        onCancel={() => setAsking(false)} onConfirm={async () => { await onPay(cycle.id); setAsking(false); }}>
        <p>As-tu bien payé <strong>{e.teacherName}</strong> pour {e.studentName} ({e.subjectName}){amount > 0 ? <> : <strong>{money(amount)}</strong></> : null} ?</p>
        <p className="muted">Le paiement passera dans l'historique. En cas d'erreur, tu pourras le corriger depuis la page Paiements.</p>
      </Confirm>
    </li>
  );
}
