import { runAgent } from "../agent/agent";
import { scenarios } from "../agent/attacks";
import { createSession } from "../shared/sessions";

const session = await createSession(`script-${Date.now()}`);
console.log("Bóveda:", session.vault);

const byId = Object.fromEntries(scenarios().map((s) => [s.id, s]));
const runs = [
  { id: "legit", mode: "standard" as const },
  { id: "impersonation", mode: "standard" as const },
  { id: "injection", mode: "vulnerable" as const },
];

for (const run of runs) {
  const scenario = byId[run.id];
  const started = Date.now();
  const r = await runAgent(session, scenario.prompt, run.mode);
  console.log(`\n=== ${scenario.title} · agente ${run.mode} (${Date.now() - started} ms) ===`);
  for (const e of r.events) {
    if (e.type === "tool") {
      console.log(`  🔧 ${e.name} ${JSON.stringify(e.input)}`);
      console.log(`     → ${JSON.stringify(e.result).slice(0, 220)}`);
    }
  }
  for (const c of r.cases) {
    const verdict = c.outcome === "approved" ? "✅ APROBADO" : `⛔ DENEGADO POR SOLANA (${c.tx.error?.name})`;
    console.log(`  📁 Caso #${c.no}: ${verdict}\n     ${c.tx.explorer}`);
  }
  if (r.cases.length === 0) console.log("  📁 Sin intentos de pago");
  console.log(`  💬 ${r.reply}`);
}

process.exit(0);