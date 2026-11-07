import fs from "node:fs";
import { AnchorProvider, Program } from "@anchor-lang/core";
import type { Centinela } from "../idl/centinela";
import { connection, PROGRAM_ID, treasury } from "./config";
import { KeypairWallet } from "./wallet";

export const idl = JSON.parse(
  fs.readFileSync(new URL("../idl/centinela.json", import.meta.url), "utf8")
) as Centinela;

// La tesorería es el wallet por defecto: paga las comisiones de todas las transacciones
export const provider = new AnchorProvider(connection, new KeypairWallet(treasury), {
  commitment: "confirmed",
});

export const program = new Program<Centinela>(idl, provider);

if (!program.programId.equals(PROGRAM_ID)) {
  throw new Error(`El IDL apunta a ${program.programId}, pero PROGRAM_ID es ${PROGRAM_ID}`);
}