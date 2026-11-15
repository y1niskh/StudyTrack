import type { ErrorRequestHandler } from "express";
import type { z } from "zod";

/** Erreur prévue : son message (en français) est montré tel quel à l'utilisateur. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Vérifie des données reçues avec un schéma zod. Invalides : 400 avec le premier message en français. */
export function parseBody<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data ?? {});
  if (!result.success) throw new HttpError(400, result.error.issues[0]?.message ?? "Les données envoyées sont invalides.");
  return result.data;
}

const GENERIC ="Une erreur est survenue. Réessaie dans un instant.";

/** Dernier middleware : transforme toute erreur en réponse `{ message }`. Les détails techniques restent dans les journaux. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) return void res.status(err.status).json({ message: err.message });
  if (err?.type === "entity.parse.failed") return void res.status(400).json({ message: "Les données envoyées sont invalides." });
  console.error(err);
  res.status(500).json({ message: GENERIC });
};
