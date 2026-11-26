import type { CSSProperties, ReactNode } from "react";
import { STATUS_LABEL } from "../lib/lessons";
import type { LessonStatus } from "../types";
import Icon, { type IconName } from "./Icon";

/* Petits éléments d'interface partagés par toutes les pages (styles : styles/ui.css). */

export function PageHeader({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}

/** Message de confirmation (vert) ou d'erreur (rouge), annoncé aux lecteurs d'écran. */
export function Notice({ kind, children, onClose, action }: { kind: "success" | "error" | "warning" | "info"; children: ReactNode; onClose?: () => void; action?: ReactNode }) {
  const icon: Record<typeof kind, IconName> = { success: "check", error: "alert", warning: "alert", info: "info" };
  return (
    <div className={`alert alert-${kind}`} role={kind === "error" ? "alert" : "status"}>
      <Icon n={icon[kind]} />
      <div className="alert-body">
        {children}
        {action && <div className="alert-actions">{action}</div>}
      </div>
      {onClose && <button type="button" className="close" onClick={onClose}>Fermer</button>}
    </div>
  );
}

export function Loading({ label = "Chargement…" }: { label?: string }) {
  return <div className="loading" role="status"><span className="spinner" aria-hidden="true" />{label}</div>;
}

export function Empty({ icon = "info", title, children, small = false }: { icon?: IconName; title?: string; children?: ReactNode; small?: boolean }) {
  return (
    <div className={`empty${small ? " empty-sm" : ""}`}>
      {!small && <Icon n={icon} />}
      {title && <strong>{title}</strong>}
      {children && <p>{children}</p>}
    </div>
  );
}

export function Stat({ icon, tone, value, label }: { icon: IconName; tone?: "accent" | "success" | "warning"; value: ReactNode; label: string }) {
  return (
    <div className="card stat">
      <span className={`stat-ico${tone ? ` is-${tone}` : ""}`}><Icon n={icon} /></span>
      <span><span className="stat-num">{value}</span><span className="stat-lab">{label}</span></span>
    </div>
  );
}

export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";
export const Badge = ({ tone, children }: { tone: BadgeTone; children: ReactNode }) => <span className={`badge badge-${tone}`}>{children}</span>;

const LESSON_TONE: Record<LessonStatus, BadgeTone> = { planned: "info", completed: "success", cancelled: "neutral" };
/** Statut d'un cours écrit en toutes lettres : Prévu, Fait, Annulé. */
export const LessonBadge = ({ status }: { status: LessonStatus }) => <Badge tone={LESSON_TONE[status]}>{STATUS_LABEL[status]}</Badge>;

/** Pastille de l'élève : son initiale dans sa couleur (la même sur toutes les pages). */
export const Avatar = ({ name, color, large = false }: { name: string; color: string; large?: boolean }) => (
  <span className={`avatar${large ? " avatar-lg" : ""}`} style={{ "--c": color } as CSSProperties} aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>
);

/** Messages du haut de page, identiques partout : chargement, erreur (avec « Réessayer » si rien n'est chargé), confirmation verte. */
export function PageMessages({ loaded, error, notice, onRetry, onCloseError, onCloseNotice }: {
  loaded: boolean; error: string; notice: string; onRetry: () => void; onCloseError: () => void; onCloseNotice: () => void;
}) {
  return (
    <>
      {error && (loaded ? <Notice kind="error" onClose={onCloseError}>{error}</Notice> : <LoadError message={error} onRetry={onRetry} />)}
      {notice && <Notice kind="success" onClose={onCloseNotice}>{notice}</Notice>}
      {!loaded && !error && <Loading />}
    </>
  );
}

/** Erreur de chargement avec bouton « Réessayer ». */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Notice kind="error" action={<button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>Réessayer</button>}>
      <strong>Les informations n'ont pas pu être chargées.</strong> {message}
    </Notice>
  );
}
