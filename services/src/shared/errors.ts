import { idl } from "./program";

export type ProgramFailure = { code: number; name: string; message: string };

// Errores de Anchor que pueden aparecer en Centinela
const ANCHOR_ERRORS: Record<number, string> = {
  2001: "ConstraintHasOne",
  2006: "ConstraintSeeds",
  3007: "AccountOwnedByWrongProgram",
  3012: "AccountNotInitialized",
};

export function decodeCode(code: number): ProgramFailure {
  const custom = idl.errors.find((e) => e.code === code);
  if (custom) return { code, name: custom.name, message: custom.msg };
  const anchor = ANCHOR_ERRORS[code];
  if (anchor) return { code, name: anchor, message: `Anchor constraint failed: ${anchor}` };
  return { code, name: "UnknownProgramError", message: `Program error ${code}` };
}

// Error devuelto por una transacción confirmada on-chain
export function failureFromTxErr(err: unknown): ProgramFailure | null {
  if (!err) return null;
  const ie = (err as { InstructionError?: [number, unknown] }).InstructionError;
  if (Array.isArray(ie)) {
    const inner = ie[1] as { Custom?: number } | string;
    if (inner && typeof inner === "object" && typeof inner.Custom === "number") {
      return decodeCode(inner.Custom);
    }
    return { code: -1, name: "InstructionError", message: JSON.stringify(inner) };
  }
  return { code: -1, name: "TransactionError", message: JSON.stringify(err) };
}

// Error lanzado durante la simulación previa (preflight) o por el RPC
export function failureFromException(e: unknown): ProgramFailure {
  const err = e as { message?: string; logs?: string[] };
  const text = [err.message ?? String(e), ...(err.logs ?? [])].join("\n");
  const match = text.match(/custom program error: 0x([0-9a-fA-F]+)/);
  if (match) return decodeCode(parseInt(match[1], 16));
  return { code: -1, name: "RpcError", message: err.message ?? String(e) };
}