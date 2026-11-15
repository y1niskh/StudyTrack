import express from "express";
import type { Config } from "../../config.ts";
import type { Db } from "../../db.ts";
import { idParam, parseBody } from "../../errors.ts";
import { currentUser, requireAuth } from "../auth/middleware.ts";
import { markPaidBody } from "./schema.ts";
import { listCycles, markPaid, markUnpaid, NOT_FOUND } from "./service.ts";

export function cycleRoutes(db: Db, cfg: Config) {
  const r = express.Router();
  r.use(requireAuth(db, cfg));

  r.get("/", async (_req, res) => {
    res.json(await listCycles(db, currentUser(res).id));
  });

  r.patch("/:id/mark-paid", async (req, res) => {
    const id = idParam(req.params.id, NOT_FOUND);
    res.json(await markPaid(db, currentUser(res).id, id, parseBody(markPaidBody, req.body)));
  });

  r.patch("/:id/mark-unpaid", async (req, res) => {
    res.json(await markUnpaid(db, currentUser(res).id, idParam(req.params.id, NOT_FOUND)));
  });

  return r;
}
