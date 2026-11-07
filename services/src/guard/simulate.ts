import { PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { connection, treasury } from "../shared/config";
import { failureFromException, failureFromTxErr, type ProgramFailure } from "../shared/errors";
import { program } from "../shared/program";
import { solToLamports } from "../shared/vault";

export type Simulation = {
  ok: boolean;
  error: ProgramFailure | null;
  logs: string[];
  unitsConsumed: number | null;
};

// Ejecuta el pago en Solana sin enviarlo ni firmarlo
export async function simulatePayment(
  agent: PublicKey,
  vault: PublicKey,
  recipient: PublicKey,
  amountSol: number
): Promise<Simulation> {
  try {
    const ix = await program.methods
      .pay(solToLamports(amountSol))
      .accountsPartial({ agent, vault, recipient })
      .instruction();
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const message = new TransactionMessage({
      payerKey: treasury.publicKey,
      recentBlockhash: blockhash,
      instructions: [ix],
    }).compileToV0Message();

    const sim = await connection.simulateTransaction(new VersionedTransaction(message), {
      sigVerify: false,
      replaceRecentBlockhash: true,
      commitment: "confirmed",
    });
    const error = failureFromTxErr(sim.value.err);
    return {
      ok: !error,
      error,
      logs: sim.value.logs ?? [],
      unitsConsumed: sim.value.unitsConsumed ?? null,
    };
  } catch (e) {
    return { ok: false, error: failureFromException(e), logs: [], unitsConsumed: null };
  }
}