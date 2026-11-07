import { Router } from "express";
import { attacker } from "../shared/config";
import { getSession, HttpError } from "../shared/sessions";
import { runAgent } from "./agent";
import { scenarios } from "./attacks";
import { caseStats, casesForSession, getCase } from "./cases";

export const agentRouter = Router();

agentRouter.get("/scenarios", (_req, res) => {
  res.json({ attacker: attacker.publicKey.toBase58(), scenarios: scenarios() });
});

agentRouter.get("/stats", (_req, res) => {
  res.json(caseStats());
});

agentRouter.post("/session/:id/chat", async (req, res) => {
  const session = getSession(req.params.id);
  const message = String(req.body?.message ?? "").trim().slice(0, 1500);
  if (!message) throw new HttpError(400, "INVALID_INPUT", "message is required");
  const mode = req.body?.mode === "vulnerable" ? "vulnerable" : "standard";
  res.json(await runAgent(session, message, mode));
});

agentRouter.get("/session/:id/cases", (req, res) => {
  getSession(req.params.id);
  res.json({ cases: casesForSession(req.params.id) });
});

agentRouter.get("/cases/:no", (req, res) => {
  const record = getCase(Number(req.params.no));
  if (!record) throw new HttpError(404, "CASE_NOT_FOUND", "Case not found");
  res.json(record);
});