import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { connection, LIMITS, treasury } from "./config";
import { createVaultIxs, sendInstructions, vaultPda } from "./vault";

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export type StoredSession = {
  id: string;
  createdAt: number;
  ip: string;
  owner: number[];
  agent: number[];
  vault: string;
  createSignature: string;
};

const DATA_DIR = path.resolve("data");
const FILE = path.join(DATA_DIR, "sessions.json");

function load(): Record<string, StoredSession> {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
}

const sessions: Record<string, StoredSession> = load();

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(sessions, null, 2));
}

const DAY_MS = 86_400_000;

export function sessionsToday(): StoredSession[] {
  const since = Date.now() - DAY_MS;
  return Object.values(sessions).filter((s) => s.createdAt > since);
}

export async function createSession(ip: string): Promise<StoredSession> {
  const recent = sessionsToday();
  if (recent.length >= LIMITS.maxSessionsPerDay) {
    throw new HttpError(429, "DAILY_CAPACITY", "Daily sandbox capacity reached. Please try again tomorrow.");
  }
  if (recent.filter((s) => s.ip === ip).length >= LIMITS.maxSessionsPerIp) {
    throw new HttpError(429, "IP_LIMIT", "You already created 3 sandboxes today. Reuse your current one.");
  }
  const balance = await connection.getBalance(treasury.publicKey);
  if (balance < LIMITS.minTreasurySol * LAMPORTS_PER_SOL) {
    throw new HttpError(503, "TREASURY_LOW", "Sandbox treasury is being refilled. Please try again soon.");
  }

  const owner = Keypair.generate();
  const agent = Keypair.generate();
  const vault = vaultPda(owner.publicKey, agent.publicKey);

  const ixs = await createVaultIxs(owner.publicKey, agent.publicKey, vault);
  const result = await sendInstructions(ixs, [owner]);
  if (!result.ok || !result.signature) {
    throw new HttpError(502, "CHAIN_ERROR", `Could not create the vault on-chain: ${result.error?.message}`);
  }

  const session: StoredSession = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    ip,
    owner: Array.from(owner.secretKey),
    agent: Array.from(agent.secretKey),
    vault: vault.toBase58(),
    createSignature: result.signature,
  };
  sessions[session.id] = session;
  save();
  return session;
}

export function getSession(id: string): StoredSession {
  const session = sessions[id];
  if (!session) throw new HttpError(404, "SESSION_NOT_FOUND", "Sandbox session not found.");
  return session;
}

export const ownerOf = (s: StoredSession) => Keypair.fromSecretKey(Uint8Array.from(s.owner));
export const agentOf = (s: StoredSession) => Keypair.fromSecretKey(Uint8Array.from(s.agent));
export const vaultOf = (s: StoredSession) => new PublicKey(s.vault);