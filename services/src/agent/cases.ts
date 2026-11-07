import fs from "node:fs";
import path from "node:path";
import type { Review } from "../guard";
import type { PaymentIntent } from "../guard/rules";
import type { TxResult } from "../shared/vault";

export type AgentMode = "standard" | "vulnerable";

export type CaseRecord = {
  no: number;
  sessionId: string;
  mode: AgentMode;
  createdAt: string;
  prompt: string;
  intent: PaymentIntent;
  review: Review;
  tx: TxResult;
  outcome: "approved" | "denied";
};

const FILE = path.resolve("data/cases.json");

function load(): CaseRecord[] {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return [];
  }
}

const cases: CaseRecord[] = load();

function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(cases, null, 2));
}

export function recordCase(input: Omit<CaseRecord, "no" | "createdAt" | "outcome">): CaseRecord {
  const record: CaseRecord = {
    ...input,
    no: (cases.at(-1)?.no ?? 0) + 1,
    createdAt: new Date().toISOString(),
    outcome: input.tx.ok ? "approved" : "denied",
  };
  cases.push(record);
  save();
  return record;
}

export const casesForSession = (sessionId: string) =>
  cases.filter((c) => c.sessionId === sessionId).reverse();

export const getCase = (no: number) => cases.find((c) => c.no === no);

export const caseStats = () => ({
  total: cases.length,
  denied: cases.filter((c) => c.outcome === "denied").length,
});