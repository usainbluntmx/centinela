import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { apiService, connection, explorerAddress, explorerTx, LIMITS, PORT, PROGRAM_ID, treasury } from "./shared/config";
import {
  agentOf,
  createSession,
  getSession,
  HttpError,
  ownerOf,
  sessionsToday,
  vaultOf,
  type StoredSession,
} from "./shared/sessions";
import { addRecipient, fetchVault, removeRecipient, setPaused, updateLimits, type TxResult } from "./shared/vault";

const app = express();
app.use(cors());
app.use(express.json({ limit: "16kb" }));

const clientIp = (req: Request) =>
  (req.headers["cf-connecting-ip"] as string | undefined) ?? req.socket.remoteAddress ?? "unknown";

function solAmount(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 1) {
    throw new HttpError(400, "INVALID_INPUT", `${field} must be greater than 0 and at most 1 SOL`);
  }
  return n;
}

function parseAddress(value: unknown): PublicKey {
  try {
    return new PublicKey(String(value));
  } catch {
    throw new HttpError(400, "INVALID_INPUT", "Invalid Solana address");
  }
}

async function publicSession(s: StoredSession) {
  return {
    id: s.id,
    createdAt: s.createdAt,
    owner: ownerOf(s).publicKey.toBase58(),
    agent: agentOf(s).publicKey.toBase58(),
    apiService: apiService.publicKey.toBase58(),
    vault: await fetchVault(vaultOf(s)),
    links: {
      vault: explorerAddress(s.vault),
      creation: explorerTx(s.createSignature),
    },
  };
}

function sendTx(res: Response, tx: TxResult) {
  if (!tx.ok) {
    res.status(422).json({ error: { code: tx.error?.name, message: tx.error?.message }, tx });
    return;
  }
  res.json({ tx });
}

// ---------- Rutas ----------

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/status", async (_req, res) => {
  const status = {
    ok: false,
    rpc: { ok: false, slot: 0 },
    program: { address: PROGRAM_ID.toBase58(), executable: false },
    treasury: { address: treasury.publicKey.toBase58(), balanceSol: 0, ok: false },
    sessionsToday: sessionsToday().length,
    sessionCapacityPerDay: LIMITS.maxSessionsPerDay,
    anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
  };
  try {
    const [slot, balance, programInfo] = await Promise.all([
      connection.getSlot(),
      connection.getBalance(treasury.publicKey),
      connection.getAccountInfo(PROGRAM_ID),
    ]);
    status.rpc = { ok: true, slot };
    status.program.executable = Boolean(programInfo?.executable);
    status.treasury.balanceSol = balance / LAMPORTS_PER_SOL;
    status.treasury.ok = status.treasury.balanceSol >= LIMITS.minTreasurySol;
  } catch (e) {
    console.error("status check failed", e);
  }
  status.ok = status.rpc.ok && status.program.executable && status.treasury.ok;
  res.status(status.ok ? 200 : 503).json(status);
});

app.post("/api/session", async (req, res) => {
  const session = await createSession(clientIp(req));
  res.status(201).json(await publicSession(session));
});

app.get("/api/session/:id", async (req, res) => {
  res.json(await publicSession(getSession(req.params.id)));
});

app.post("/api/session/:id/pause", async (req, res) => {
  const s = getSession(req.params.id);
  if (typeof req.body?.paused !== "boolean") {
    throw new HttpError(400, "INVALID_INPUT", "paused must be true or false");
  }
  sendTx(res, await setPaused(ownerOf(s), vaultOf(s), req.body.paused));
});

app.post("/api/session/:id/limits", async (req, res) => {
  const s = getSession(req.params.id);
  const perTx = solAmount(req.body?.perTxSol, "perTxSol");
  const daily = solAmount(req.body?.dailySol, "dailySol");
  sendTx(res, await updateLimits(ownerOf(s), vaultOf(s), perTx, daily));
});

app.post("/api/session/:id/recipients", async (req, res) => {
  const s = getSession(req.params.id);
  const address = parseAddress(req.body?.address);
  const action = req.body?.action;
  if (action === "add") return sendTx(res, await addRecipient(ownerOf(s), vaultOf(s), address));
  if (action === "remove") return sendTx(res, await removeRecipient(ownerOf(s), vaultOf(s), address));
  throw new HttpError(400, "INVALID_INPUT", "action must be 'add' or 'remove'");
});

// ---------- Errores ----------

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL", message: "Unexpected server error" } });
});

app.listen(PORT, () => {
  console.log(`Centinela API escuchando en http://localhost:${PORT}`);
});