import express from "express";
import type { Config } from "../../config.ts";
import type { Db } from "../../db.ts";
import { currentUser, requireAuth } from "../auth/middleware.ts";
import { resetYear } from "./service.ts";

export function yearRoutes(db: Db, cfg: Config) {
  const r = express.Router();
  r.use(requireAuth(db, cfg));
  r.post("/", async (_req, res) => {
    await resetYear(db, currentUser(res).id);
    res.status(204).end();
  });
  return r;
}
