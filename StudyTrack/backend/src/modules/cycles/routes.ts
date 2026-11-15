import express from "express";
import type { Config } from "../../config.ts";
import type { Db } from "../../db.ts";
import { currentUser, requireAuth } from "../auth/middleware.ts";
import { listCycles } from "./service.ts";

export function cycleRoutes(db: Db, cfg: Config) {
  const r = express.Router();
  r.use(requireAuth(db, cfg));
  r.get("/", async (_req, res) => {
    res.json(await listCycles(db, currentUser(res).id));
  });
  return r;
}
