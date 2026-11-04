import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authenticate, ApiError } from "../services/auth";
import { validateAuth, MIN_PASSWORD, type AuthErrors, type AuthFields } from "../lib/validation";
import FridgeDecor from "./FridgeDecor";
import "./AuthPage.css";

const LETTERS = "StudyTrack".split("");

const EMPTY: AuthFields = { name: "", email: "", password: "", confirm: "" };

export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register";
  const navigate = useNavigate();
  const [values, setValues] = useState<AuthFields>(EMPTY);
  const [errors, setErrors] = useState<AuthErrors>({});
  const [formError, setFormError] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof AuthFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    const errs = validateAuth(mode, values);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setLoading(true);
    try {
      await authenticate(mode, { name: values.name.trim(), email: values.email.trim(), password: values.password });
      navigate("/", { replace: true });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Une erreur est survenue. Réessaie dans un instant.");
    } finally {
      setLoading(false);
    }
  }

  const field = (id: keyof AuthFields, label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id} value={values[id]} onChange={set(id)} aria-invalid={!!errors[id]}
        aria-describedby={errors[id] ? `${id}-err` : undefined} {...props}
      />
      {errors[id] && <p className="field-error" id={`${id}-err`}>{errors[id]}</p>}
    </div>
  );

  const pwdType = showPwd ? "text" : "password";

  return (
    <main className="fridge">
      <FridgeDecor />
      <div className="auth">
      <h1 className="brand" aria-label="StudyTrack">
        {LETTERS.map((l, i) => (
          <span key={i} aria-hidden="true" className={`tile t${i % 5}`}>{l}</span>
        ))}
      </h1>
      <p className="tagline">Le suivi des cours particuliers, séance après séance.</p>

      <form className="sheet" onSubmit={onSubmit} noValidate>
        <i className="magnet big" aria-hidden="true" />
        <h2>{isRegister ? "Créer un compte" : "Connexion"}</h2>

        {formError && <p className="form-error" role="alert">{formError}</p>}

        {isRegister && field("name", "Nom", { type: "text", autoComplete: "name" })}
        {field("email", "Adresse e-mail", { type: "email", autoComplete: "email", inputMode: "email" })}
        {field("password", "Mot de passe", {
          type: pwdType, autoComplete: isRegister ? "new-password" : "current-password",
        })}
        {isRegister && (
          <>
            <p className="hint">{MIN_PASSWORD} caractères minimum.</p>
            {field("confirm", "Confirmer le mot de passe", { type: pwdType, autoComplete: "new-password" })}
          </>
        )}

        <label className="check">
          <input type="checkbox" checked={showPwd} onChange={(e) => setShowPwd(e.target.checked)} />
          Afficher le mot de passe
        </label>

        <button className="primary" type="submit" disabled={loading}>
          {loading ? "Un instant…" : isRegister ? "Créer mon compte" : "Se connecter"}
        </button>

        <p className="switch">
          {isRegister ? "Tu as déjà un compte ?" : "Pas encore de compte ?"}{" "}
          <Link to={isRegister ? "/connexion" : "/inscription"}>
            {isRegister ? "Se connecter" : "Créer un compte"}
          </Link>
        </p>
      </form>

      </div>
    </main>
  );
}
