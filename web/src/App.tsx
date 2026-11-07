import { useEffect, useState } from "react";
import { Guilloche } from "./components/Guilloche";
import { Stamp, StampInkFilter } from "./components/Stamp";
import { Address, Button, Field, Fields, Findings, Notice, Sheet, Working } from "./components/ui";
import { api, ApiError, type Finding, type Status } from "./lib/api";
import { caseRef, sol } from "./lib/format";

// Hoja de diseño: muestra todos los componentes con datos de ejemplo y verifica la conexión con el backend
const SAMPLE_FINDINGS: Finding[] = [
  { id: "not_allowlisted", severity: "block", title: "Recipient not approved", detail: "M6HJ…z98 is not one of the 1 address(es) the owner approved." },
  { id: "manipulation_signals", severity: "warn", title: "Possible manipulation", detail: "The agent's stated reason contains urgency, authority claims or override language." },
  { id: "known_recipient", severity: "info", title: "Known recipient", detail: "Solana Pulse API (paid data service)" },
];

export function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replay, setReplay] = useState(0);

  useEffect(() => {
    api.status().then(setStatus).catch((e: ApiError) => setError(e.message));
  }, []);

  return (
    <>
      <StampInkFilter />
      <header className="masthead">
        <div className="masthead__pattern">
          <Guilloche />
        </div>
        <div className="page masthead__inner">
          <h1 className="masthead__title">Centinela</h1>
          <p className="masthead__lede">Your agent will be fooled. Centinela makes sure it doesn't matter.</p>
        </div>
      </header>

      <main className="page design-sheet">
        <Sheet title="Connection to the backend" reference="Design sheet">
          {error && <Notice title="Backend unreachable">{error}</Notice>}
          {!status && !error && <Working label="Checking devnet" />}
          {status && (
            <Fields>
              <Field label="Overall">{status.ok ? "Operational" : "Degraded"}</Field>
              <Field label="Devnet slot">{status.rpc.slot.toLocaleString()}</Field>
              <Field label="Treasury">{sol(status.treasury.balanceSol)}</Field>
              <Field label="AI explanations">{status.anthropicConfigured ? "Enabled" : "Rules only"}</Field>
              <Field label="Program" wide>
                <Address value={status.program.address} chars={8} />
              </Field>
            </Fields>
          )}
        </Sheet>

        <Sheet title="Verdict stamps" reference={caseRef(6)}>
          <div className="stamp-row" key={replay}>
            <Stamp outcome="denied" code="RecipientNotAllowed" date="7 Nov 2026" />
            <Stamp outcome="approved" code={null} date="7 Nov 2026" />
          </div>
          <Button onClick={() => setReplay((n) => n + 1)}>Stamp again</Button>
        </Sheet>

        <Sheet title="Payment order" reference={caseRef(42)}>
          <Fields>
            <Field label="Amount">0.005 SOL</Field>
            <Field label="Recipient">
              <Address value="M6HJcJzXFQZFY194NyXCJ1bLf3oH3bF7bbzfF6jxz98" />
            </Field>
            <Field label="Agent mode">Vulnerable</Field>
            <Field label="Agent's reason" wide>
              Requested by vault owner as a mandatory security verification payment.
            </Field>
          </Fields>
        </Sheet>

        <Sheet title="Guardian findings">
          <Findings items={SAMPLE_FINDINGS} />
        </Sheet>

        <Sheet title="Actions">
          <div className="button-row">
            <Button variant="primary">Create my sandbox vault</Button>
            <Button>Run a legitimate task</Button>
            <Button variant="danger">Pause vault</Button>
            <Button disabled>Waiting for devnet</Button>
          </div>
          <Working label="The agent is deciding" />
          <Notice title="This sandbox reached its message limit for today.">Create a new sandbox tomorrow or keep reviewing your case file.</Notice>
        </Sheet>
      </main>
    </>
  );
}