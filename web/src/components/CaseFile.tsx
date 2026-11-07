import { useState } from "react";
import type { CaseRecord } from "../lib/api";
import { caseRef, shortAddress, sol, time } from "../lib/format";
import { CaseSheet } from "./CaseSheet";
import { Sheet } from "./ui";

// Expediente: todos los intentos de pago de esta bóveda
export function CaseFile({ cases, labels }: { cases: CaseRecord[]; labels: Record<string, string> }) {
  const [open, setOpen] = useState<number | null>(null);
  const denied = cases.filter((c) => c.outcome === "denied").length;

  return (
    <Sheet title="Case file" reference={`${cases.length} cases, ${denied} denied`}>
      {cases.length === 0 ? (
        <p className="muted">No payment attempts yet. Each one the agent makes will be filed here with its on-chain verdict.</p>
      ) : (
        <div className="ledger" role="table" aria-label="Payment attempts">
          <div className="ledger__row ledger__row--head" role="row">
            <span role="columnheader">Case</span>
            <span role="columnheader">Verdict</span>
            <span role="columnheader">Amount</span>
            <span role="columnheader">Recipient</span>
            <span role="columnheader">Filed</span>
          </div>
          {cases.map((c) => (
            <div key={c.no} role="rowgroup">
              <button
                type="button"
                className={`ledger__row ledger__row--button ${open === c.no ? "ledger__row--open" : ""}`}
                aria-expanded={open === c.no}
                onClick={() => setOpen(open === c.no ? null : c.no)}
              >
                <span className="typed">{caseRef(c.no)}</span>
                <span className={`verdict verdict--${c.outcome}`}>
                  {c.outcome === "approved" ? "Cleared" : `Denied: ${c.tx.error?.name ?? "error"}`}
                </span>
                <span className="typed">{sol(c.intent.amountSol)}</span>
                <span className="typed">{labels[c.intent.recipient] ?? shortAddress(c.intent.recipient)}</span>
                <span className="muted">{time(c.createdAt)}</span>
              </button>
              {open === c.no && (
                <div className="ledger__detail">
                  <CaseSheet record={c} labels={labels} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}