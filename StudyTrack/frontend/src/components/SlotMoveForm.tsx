import { useId, useState, type FormEvent } from "react";
import { WEEKDAYS } from "../lib/slots";
import type { Slot } from "../types";

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // lundi en premier
const cap = (d: string) => d[0].toUpperCase() + d.slice(1);

/* Changer le jour et/ou l'heure d'un cours chaque semaine (à partir d'aujourd'hui). */
export default function SlotMoveForm({ slot, busy, onSubmit, onCancel }: {
  slot: Slot; busy: boolean; onSubmit: (to: { weekday: number; time: string }) => void; onCancel: () => void;
}) {
  const uid = useId();
  const [weekday, setWeekday] = useState(slot.weekday);
  const [time, setTime] = useState(slot.time);
  const [err, setErr] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!time) return setErr("Indique l'heure du cours.");
    if (weekday === slot.weekday && time === slot.time) return setErr("Le jour et l'heure sont les mêmes qu'avant : change au moins l'un des deux.");
    setErr(""); onSubmit({ weekday, time });
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <fieldset className="form-section">
        <legend className="label">Nouveau jour <span className="req">*</span></legend>
        <div className="choices">
          {DAY_ORDER.map((d) => (
            <label key={d} className="choice">
              <input type="radio" name={`${uid}-wd`} checked={weekday === d} onChange={() => setWeekday(d)} />
              <span>{cap(WEEKDAYS[d])}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor={`${uid}-t`}>Nouvelle heure <span className="req">*</span></label>
        <input id={`${uid}-t`} className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </div>
      <p className="hint">Le changement compte à partir d'aujourd'hui. Les cours passés ne bougent pas, et ceux qui restent à confirmer sont gardés.</p>
      {err && <p className="field-error" role="alert">{err}</p>}
      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Un instant…" : "Enregistrer les modifications"}</button>
        <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={busy}>Annuler</button>
      </div>
    </form>
  );
}
