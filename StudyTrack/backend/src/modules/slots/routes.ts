import express from "express";
import type { Config } from "../../config.ts";
import type { Db } from "../../db.ts";
import { idParam, parseBody } from "../../errors.ts";
import { currentUser, requireAuth } from "../auth/middleware.ts";
import { slotCreate } from "./schema.ts";
import { createSlot, deleteSlot, listSlots, NOT_FOUND } from "./service.ts";

export function slotRoutes(db: Db, cfg: Config) {
  const r = express.Router();
  r.use(requireAuth(db, cfg));

  r.get("/", async (_req, res) => {
    res.json(await listSlots(db, currentUser(res).id));
  });

  r.post("/", async (req, res) => {
    res.status(201).json(await createSlot(db, currentUser(res).id, parseBody(slotCreate, req.body)));
  });

  r.delete("/:id", async (req, res) => {
    await deleteSlot(db, currentUser(res).id, idParam(req.params.id, NOT_FOUND));
    res.status(204).end();
  });

  return r;
}
