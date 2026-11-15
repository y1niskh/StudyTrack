import express from "express";
import type { Config } from "../../config.ts";
import type { Db } from "../../db.ts";
import { idParam, parseBody } from "../../errors.ts";
import { currentUser, requireAuth } from "../auth/middleware.ts";
import { lessonCreate, lessonPatch } from "./schema.ts";
import { createLesson, deleteLesson, listLessons, NOT_FOUND, updateLesson } from "./service.ts";

export function lessonRoutes(db: Db, cfg: Config) {
  const r = express.Router();
  r.use(requireAuth(db, cfg));

  r.get("/", async (_req, res) => {
    res.json(await listLessons(db, currentUser(res).id));
  });

  r.post("/", async (req, res) => {
    const input = parseBody(lessonCreate, req.body);
    // Des ids mal formés ne peuvent exister : 404, pas une erreur de la base.
    idParam(input.enrollmentId, "Ce cours suivi n'existe pas.");
    if (input.slotId) idParam(input.slotId, "Ce cours qui se répète n'existe plus.");
    res.status(201).json(await createLesson(db, currentUser(res).id, input));
  });

  r.patch("/:id", async (req, res) => {
    const id = idParam(req.params.id, NOT_FOUND);
    res.json(await updateLesson(db, currentUser(res).id, id, parseBody(lessonPatch, req.body)));
  });

  r.delete("/:id", async (req, res) => {
    await deleteLesson(db, currentUser(res).id, idParam(req.params.id, NOT_FOUND));
    res.status(204).end();
  });

  return r;
}
