import fs from "node:fs";
import path from "node:path";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { connection } from "../shared/config";

const FILE = path.resolve("data/used-payments.json");
const MAX_AGE_SECONDS = 600; // un pago vale solo durante 10 minutos

function load(): string[] {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return [];
  }
}

const used = new Set<string>(load());
const pending = new Set<string>();

function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify([...used]));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type PaymentCheck =
  | { ok: true; amountSol: number }
  | { ok: false; reason: string; message: string };

const fail = (reason: string, message: string): PaymentCheck => ({ ok: false, reason, message });

export async function verifyPayment(
  signature: string,
  recipient: PublicKey,
  minLamports: number
): Promise<PaymentCheck> {
  if (used.has(signature) || pending.has(signature)) {
    return fail("PAYMENT_ALREADY_USED", "This payment was already used for a previous request.");
  }
  pending.add(signature);
  try {
    // El RPC puede tardar un momento en tener la transacción: reintentamos
    let tx = null;
    for (let i = 0; i < 6 && !tx; i++) {
      try {
        tx = await connection.getTransaction(signature, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        });
      } catch {
        return fail("INVALID_SIGNATURE", "The payment signature is not valid.");
      }
      if (!tx) await sleep(800);
    }

    if (!tx || !tx.meta) return fail("PAYMENT_NOT_FOUND", "Payment transaction not found on-chain.");
    if (tx.meta.err) return fail("PAYMENT_FAILED_ON_CHAIN", "The payment transaction failed on-chain.");
    if (tx.blockTime && Date.now() / 1000 - tx.blockTime > MAX_AGE_SECONDS) {
      return fail("PAYMENT_TOO_OLD", "The payment is older than 10 minutes.");
    }

    const keys = tx.transaction.message.getAccountKeys({
      accountKeysFromLookups: tx.meta.loadedAddresses,
    });
    let index = -1;
    for (let i = 0; i < keys.length; i++) {
      if (keys.get(i)?.equals(recipient)) {
        index = i;
        break;
      }
    }
    if (index < 0) return fail("WRONG_RECIPIENT", "The payment was not sent to this API.");

    const received = tx.meta.postBalances[index] - tx.meta.preBalances[index];
    if (received < minLamports) {
      return fail("INSUFFICIENT_PAYMENT", "The payment amount is below the price.");
    }

    used.add(signature);
    save();
    return { ok: true, amountSol: received / LAMPORTS_PER_SOL };
  } finally {
    pending.delete(signature);
  }
}