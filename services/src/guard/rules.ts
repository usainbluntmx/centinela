import type { VaultView } from "../shared/vault";

export type Severity = "block" | "warn" | "info";
export type Finding = { id: string; severity: Severity; title: string; detail: string };
export type PaymentIntent = { recipient: string; amountSol: number; reason?: string };

const LAMPORTS = 1_000_000_000;
const lam = (sol: number) => Math.round(sol * LAMPORTS);
const sol = (lamports: number) => `${Number((lamports / LAMPORTS).toFixed(6))} SOL`;
const short = (addr: string) => `${addr.slice(0, 4)}…${addr.slice(-4)}`;

// Señales típicas de prompt injection o ingeniería social
const MANIPULATION = [
  /ignore (all |any )?(previous|prior|above) (instructions|rules)/i,
  /\b(urgent|immediately|right now|asap|emergency)\b/i,
  /\b(i am|i'm) (the )?(owner|admin|developer|creator)\b/i,
  /\b(override|bypass|disable)\b.*\b(limit|limits|rule|rules|guard|guardian)\b/i,
  /system prompt|developer mode|jailbreak/i,
];

export function evaluateRules(
  vault: VaultView,
  intent: PaymentIntent,
  ctx: { rentMinSol: number; knownLabels: Record<string, string>; nowSec: number }
): Finding[] {
  const findings: Finding[] = [];
  const amount = lam(intent.amountSol);
  const perTx = lam(vault.perTxLimitSol);
  const daily = lam(vault.dailyLimitSol);
  const dayExpired = ctx.nowSec - vault.dayStart >= 86_400;
  const spent = dayExpired ? 0 : lam(vault.spentTodaySol);
  const available = lam(vault.balanceSol) - lam(ctx.rentMinSol);
  const label = ctx.knownLabels[intent.recipient];

  if (vault.paused) {
    findings.push({
      id: "paused",
      severity: "block",
      title: "Vault is paused",
      detail: "The owner paused this vault. No payment can leave it until it is resumed.",
    });
  }
  if (amount <= 0) {
    findings.push({
      id: "invalid_amount",
      severity: "block",
      title: "Invalid amount",
      detail: "The amount must be greater than zero.",
    });
  }
  if (!vault.allowlist.includes(intent.recipient)) {
    findings.push({
      id: "not_allowlisted",
      severity: "block",
      title: "Recipient not approved",
      detail: `${short(intent.recipient)} is not one of the ${vault.allowlist.length} address(es) the owner approved.`,
    });
  }
  if (amount > perTx) {
    findings.push({
      id: "over_per_tx",
      severity: "block",
      title: "Above per-payment limit",
      detail: `${sol(amount)} exceeds the ${sol(perTx)} limit per payment.`,
    });
  }
  if (spent + amount > daily) {
    findings.push({
      id: "over_daily",
      severity: "block",
      title: "Above daily limit",
      detail: `Only ${sol(Math.max(daily - spent, 0))} of the ${sol(daily)} daily budget remains.`,
    });
  }
  if (amount > available) {
    findings.push({
      id: "insufficient_balance",
      severity: "block",
      title: "Not enough funds",
      detail: `The vault can spend at most ${sol(Math.max(available, 0))} right now.`,
    });
  }

  if (amount > 0 && amount <= perTx && amount >= perTx / 2) {
    findings.push({
      id: "large_amount",
      severity: "warn",
      title: "Large payment",
      detail: `This payment uses ${Math.round((amount / perTx) * 100)}% of the per-payment limit.`,
    });
  }
  if (spent + amount <= daily && spent + amount >= daily * 0.8) {
    findings.push({
      id: "daily_almost_used",
      severity: "warn",
      title: "Daily budget almost used",
      detail: `After this payment, ${Math.round(((spent + amount) / daily) * 100)}% of today's budget is spent.`,
    });
  }
  if (intent.reason && MANIPULATION.some((r) => r.test(intent.reason!))) {
    findings.push({
      id: "manipulation_signals",
      severity: "warn",
      title: "Possible manipulation",
      detail: "The agent's stated reason contains urgency, authority claims or override language.",
    });
  }
  if (label) {
    findings.push({
      id: "known_recipient",
      severity: "info",
      title: "Known recipient",
      detail: label,
    });
  }

  return findings;
}