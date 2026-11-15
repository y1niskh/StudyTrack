import express from "express";
import type { Config } from "../../config.ts";
import type { Db } from "../../db.ts";
import { idParam, parseBody } from "../../errors.ts";
import { currentUser, requireAuth } from "../auth/middleware.ts";
import { enrollmentPatch } from "./schema.ts";
import { listEnrollments, NOT_FOUND, updateEnrollment } from "./service.ts";

export function enrollmentRoutes(db: Db, cfg: Config) {
  const r = express.Router();
  r.use(requireAuth(db, cfg));

  r.get("/", async (_req, res) => {
    res.json(await listEnrollments(db, currentUser(res).id));
  });

  r.patch("/:id", async (req, res) => {
    const id = idParam(req.params.id, NOT_FOUND);
    res.json(await updateEnrollment(db, currentUser(res).id, id, parseBody(enrollmentPatch, req.body)));
  });

  return r;
}
