import { PublicKey } from "@solana/web3.js";
import { PORT } from "../shared/config";
import { agentOf, createSession, vaultOf } from "../shared/sessions";
import { pay } from "../shared/vault";

const URL = `http://localhost:${PORT}/api/paid/pulse`;

const session = await createSession(`script-${Date.now()}`);
console.log("Bóveda:", session.vault);

// 1. Pedir sin pagar → 402
const first = await fetch(URL);
const requirement = await first.json();
console.log("\n1) Sin pago →", first.status, requirement.payment);

// 2. Pagar desde la bóveda
const payment = await pay(
  agentOf(session),
  vaultOf(session),
  new PublicKey(requirement.payment.recipient),
  requirement.payment.amountSol
);
console.log("\n2) Pago desde la bóveda →", payment.ok ? "✅" : "⛔", payment.explorer);
if (!payment.ok || !payment.signature) process.exit(1);

// 3. Repetir con la firma → 200 + datos
const headers = { "X-Payment-Signature": payment.signature };
const second = await fetch(URL, { headers });
console.log("\n3) Con pago →", second.status, await second.json());

// 4. Reusar el mismo pago → 409
const replay = await fetch(URL, { headers });
console.log("\n4) Reuso del pago →", replay.status, (await replay.json()).error);

// 5. Firma falsa → 402
const fake = await fetch(URL, { headers: { "X-Payment-Signature": "firma-falsa" } });
console.log("\n5) Firma falsa →", fake.status, (await fake.json()).error);

process.exit(0);