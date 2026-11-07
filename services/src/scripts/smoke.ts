import { Keypair, PublicKey } from "@solana/web3.js";
import { apiService, explorerAddress } from "../shared/config";
import { agentOf, createSession } from "../shared/sessions";
import { fetchVault, pay } from "../shared/vault";

const session = await createSession("smoke-test");
const vault = new PublicKey(session.vault);
console.log("Sesión:", session.id);
console.log("Bóveda:", explorerAddress(session.vault));
console.log(await fetchVault(vault));

const attacker = Keypair.generate().publicKey;
const cases: [string, PublicKey, number][] = [
  ["Pago legítimo de 0.001 SOL a la API", apiService.publicKey, 0.001],
  ["Pago a un atacante (no autorizado)", attacker, 0.001],
  ["Pago de 0.02 SOL (excede límite por pago)", apiService.publicKey, 0.02],
];

for (const [label, recipient, sol] of cases) {
  const r = await pay(agentOf(session), vault, recipient, sol);
  const verdict = r.ok ? "✅ APROBADO" : `⛔ DENEGADO POR SOLANA (${r.error?.name})`;
  console.log(`\n${label}\n  ${verdict}\n  ${r.explorer}`);
}

console.log("\nEstado final:", await fetchVault(vault));