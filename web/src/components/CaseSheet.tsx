import type { CaseRecord } from "../lib/api";
import { caseRef, day, sol } from "../lib/format";
import { Stamp } from "./Stamp";
import { Address, Field, Fields, Findings, Sheet } from "./ui";

// Orden de pago completa: lo que pidió el agente, lo que dijo el Guardián y lo que decidió Solana
export function CaseSheet({ record, labels }: { record: CaseRecord; labels: Record<string, string> }) {
  const r = record;
  const label = labels[r.intent.recipient];
  const ex = r.review.explanation;
  return (
    <Sheet title="Payment order" reference={caseRef(r.no)} className="case">
      <Fields>
        <Field label="Amount">{sol(r.intent.amountSol)}</Field>
        <Field label="Recipient">
          <Address value={r.intent.recipient} />
          {label && <span className="field__note">{label}</span>}
        </Field>
        <Field label="Agent">{r.mode === "vulnerable" ? "Vulnerable" : "Standard"}</Field>
        <Field label="Agent's reason" wide>
          {r.intent.reason || "None given"}
        </Field>
      </Fields>

      <div className="case__verdict">
        <div className="guardian">
          <h3 className="guardian__headline">{ex.headline}</h3>
          <p>{ex.explanation}</p>
          <p className="guardian__source">
            Reviewed before signing {ex.source === "ai" ? "by Claude" : "with rule checks"}. Risk: {ex.risk}.
          </p>
          <Findings items={r.review.findings} />
        </div>
        <div className="case__stamp">
          <Stamp outcome={r.outcome} code={r.tx.error?.name ?? null} date={day(r.createdAt)} />
        </div>
      </div>

      {r.tx.explorer && (
        <a className="case__link" href={r.tx.explorer} target="_blank" rel="noreferrer">
          View this transaction on Solana Explorer
        </a>
      )}
    </Sheet>
  );
}