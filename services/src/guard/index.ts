import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { apiService, connection } from "../shared/config";
import { agentOf, HttpError, vaultOf, type StoredSession } from "../shared/sessions";
import { fetchVault } from "../shared/vault";
import { explain } from "./explain";
import { evaluateRules, type PaymentIntent } from "./rules";
import { simulatePayment } from "./simulate";

export const knownLabels = (): Record<string, string> => ({
  [apiService.publicKey.toBase58()]: "Solana Pulse API (paid data service)",
});

export async function reviewPayment(session: StoredSession, intent: PaymentIntent) {
  let recipient: PublicKey;
  try {
    recipient = new PublicKey(intent.recipient);
  } catch {
    throw new HttpError(400, "INVALID_INPUT", "Invalid recipient address");
  }

  const vaultKey = vaultOf(session);
  const [vault, info] = await Promise.all([fetchVault(vaultKey), connection.getAccountInfo(vaultKey)]);
  if (!vault || !info) throw new HttpError(404, "VAULT_NOT_FOUND", "Vault not found on-chain");

  const rentMinSol =
    (await connection.getMinimumBalanceForRentExemption(info.data.length)) / LAMPORTS_PER_SOL;
  const labels = knownLabels();

  const findings = evaluateRules(vault, intent, {
    rentMinSol,
    knownLabels: labels,
    nowSec: Math.floor(Date.now() / 1000),
  });
  const simulation = await simulatePayment(
    agentOf(session).publicKey,
    vaultKey,
    recipient,
    intent.amountSol
  );

  const explanation = await explain({
    intent,
    recipientLabel: labels[intent.recipient] ?? "Unknown address",
    vaultRules: {
      perTxLimitSol: vault.perTxLimitSol,
      dailyLimitSol: vault.dailyLimitSol,
      spentTodaySol: vault.spentTodaySol,
      balanceSol: vault.balanceSol,
      paused: vault.paused,
      approvedRecipients: vault.allowlist.length,
    },
    findings,
    simulation: { ok: simulation.ok, error: simulation.error },
  });

  return {
    verdict: simulation.ok ? ("approve" as const) : ("deny" as const),
    findings,
    simulation: {
      ok: simulation.ok,
      error: simulation.error,
      unitsConsumed: simulation.unitsConsumed,
      logs: simulation.logs.slice(-8),
    },
    explanation,
    reviewedAt: new Date().toISOString(),
  };
}

export type Review = Awaited<ReturnType<typeof reviewPayment>>;