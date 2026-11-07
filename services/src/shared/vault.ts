import BN from "bn.js";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { apiService, connection, explorerTx, LIMITS, PROGRAM_ID, treasury } from "./config";
import { failureFromException, failureFromTxErr, type ProgramFailure } from "./errors";
import { program } from "./program";

export const solToLamports = (sol: number) => new BN(Math.round(sol * LAMPORTS_PER_SOL));
const toSol = (v: BN) => v.toNumber() / LAMPORTS_PER_SOL;

export function vaultPda(owner: PublicKey, agent: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), owner.toBuffer(), agent.toBuffer()],
    PROGRAM_ID
  )[0];
}

export type TxResult = {
  ok: boolean;
  signature: string | null;
  explorer: string | null;
  error: ProgramFailure | null;
};

// Envía instrucciones con la tesorería como pagadora de comisiones.
// skipPreflight = true hace que una transacción rechazada quede registrada on-chain.
export async function sendInstructions(
  ixs: TransactionInstruction[],
  signers: Keypair[],
  opts: { skipPreflight?: boolean } = {}
): Promise<TxResult> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: treasury.publicKey, blockhash, lastValidBlockHeight }).add(
    ...ixs
  );
  const extra = signers.filter((s) => !s.publicKey.equals(treasury.publicKey));
  tx.sign(treasury, ...extra);

  let signature: string;
  try {
    signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: opts.skipPreflight ?? false,
      maxRetries: 5,
    });
  } catch (e) {
    return { ok: false, signature: null, explorer: null, error: failureFromException(e) };
  }

  let txErr: unknown = null;
  try {
    const conf = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed"
    );
    txErr = conf.value.err;
  } catch (e) {
    // web3.js rechaza la promesa con el error on-chain si la tx ya había fallado
    if (e && typeof e === "object" && "InstructionError" in e) {
      txErr = e;
    } else {
      return {
        ok: false,
        signature,
        explorer: explorerTx(signature),
        error: failureFromException(e),
      };
    }
  }

  const error = failureFromTxErr(txErr);
  return { ok: !error, signature, explorer: explorerTx(signature), error };
}

// ---------- Lectura ----------

export async function fetchVault(address: PublicKey) {
  const [acc, lamports] = await Promise.all([
    program.account.vault.fetchNullable(address),
    connection.getBalance(address),
  ]);
  if (!acc) return null;
  return {
    address: address.toBase58(),
    owner: acc.owner.toBase58(),
    agent: acc.agent.toBase58(),
    perTxLimitSol: toSol(acc.perTxLimit),
    dailyLimitSol: toSol(acc.dailyLimit),
    spentTodaySol: toSol(acc.spentToday),
    dayStart: acc.dayStart.toNumber(),
    paused: acc.paused,
    totalPaidSol: toSol(acc.totalPaid),
    payments: acc.payments.toNumber(),
    allowlist: acc.allowlist.map((k) => k.toBase58()),
    balanceSol: lamports / LAMPORTS_PER_SOL,
  };
}

export type VaultView = NonNullable<Awaited<ReturnType<typeof fetchVault>>>;

// ---------- Creación (sesión sandbox) ----------

export async function createVaultIxs(owner: PublicKey, agent: PublicKey, vault: PublicKey) {
  return [
    SystemProgram.transfer({
      fromPubkey: treasury.publicKey,
      toPubkey: owner,
      lamports: Math.round(LIMITS.ownerFundSol * LAMPORTS_PER_SOL),
    }),
    await program.methods
      .initializeVault(
        agent,
        solToLamports(LIMITS.defaultPerTxSol),
        solToLamports(LIMITS.defaultDailySol)
      )
      .accountsPartial({ owner, vault, systemProgram: SystemProgram.programId })
      .instruction(),
    SystemProgram.transfer({
      fromPubkey: treasury.publicKey,
      toPubkey: vault,
      lamports: Math.round(LIMITS.sessionFundSol * LAMPORTS_PER_SOL),
    }),
    await program.methods
      .addRecipient(apiService.publicKey)
      .accountsPartial({ owner, vault })
      .instruction(),
  ];
}

// ---------- Agente ----------

export async function pay(agent: Keypair, vault: PublicKey, recipient: PublicKey, sol: number) {
  const ix = await program.methods
    .pay(solToLamports(sol))
    .accountsPartial({ agent: agent.publicKey, vault, recipient })
    .instruction();
  return sendInstructions([ix], [agent], { skipPreflight: true });
}

// ---------- Dueño ----------

export async function setPaused(owner: Keypair, vault: PublicKey, paused: boolean) {
  const ix = await program.methods
    .setPaused(paused)
    .accountsPartial({ owner: owner.publicKey, vault })
    .instruction();
  return sendInstructions([ix], [owner]);
}

export async function updateLimits(owner: Keypair, vault: PublicKey, perTxSol: number, dailySol: number) {
  const ix = await program.methods
    .updateLimits(solToLamports(perTxSol), solToLamports(dailySol))
    .accountsPartial({ owner: owner.publicKey, vault })
    .instruction();
  return sendInstructions([ix], [owner]);
}

export async function addRecipient(owner: Keypair, vault: PublicKey, recipient: PublicKey) {
  const ix = await program.methods
    .addRecipient(recipient)
    .accountsPartial({ owner: owner.publicKey, vault })
    .instruction();
  return sendInstructions([ix], [owner]);
}

export async function removeRecipient(owner: Keypair, vault: PublicKey, recipient: PublicKey) {
  const ix = await program.methods
    .removeRecipient(recipient)
    .accountsPartial({ owner: owner.publicKey, vault })
    .instruction();
  return sendInstructions([ix], [owner]);
}