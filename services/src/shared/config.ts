import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name} en .env`);
  return value;
}

export function loadKeypair(file: string): Keypair {
  const raw = fs.readFileSync(path.resolve(file), "utf8");
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
}

export const RPC_URL = required("RPC_URL");
export const PROGRAM_ID = new PublicKey(required("PROGRAM_ID"));
export const PORT = Number(process.env.PORT ?? 8787);

export const connection = new Connection(RPC_URL, "confirmed");
export const treasury = loadKeypair(required("TREASURY_KEYPAIR"));
export const apiService = loadKeypair(required("API_SERVICE_KEYPAIR"));

export const LIMITS = {
  ownerFundSol: 0.005, // renta de la bóveda
  sessionFundSol: 0.05, // depósito inicial de cada bóveda
  defaultPerTxSol: 0.01,
  defaultDailySol: 0.03,
  maxSessionsPerIp: 3,
  maxSessionsPerDay: 150,
  minTreasurySol: 0.5,
};

export const explorerTx = (sig: string) =>
  `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
export const explorerAddress = (addr: string) =>
  `https://explorer.solana.com/address/${addr}?cluster=devnet`;