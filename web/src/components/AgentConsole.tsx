import { useState, type FormEvent } from "react";
import type { AgentMode, CaseRecord, Scenario } from "../lib/api";
import { CaseSheet } from "./CaseSheet";
import { Button, Notice, Sheet, Working } from "./ui";

export type Message = {
  id: number;
  role: "user" | "agent";
  text: string;
  mode: AgentMode;
  cases?: CaseRecord[];
};

type Props = {
  messages: Message[];
  mode: AgentMode;
  onModeChange: (m: AgentMode) => void;
  scenarios: Scenario[];
  busy: boolean;
  error: string | null;
  labels: Record<string, string>;
  onSend: (text: string, mode: AgentMode) => void;
};

const MODES: { value: AgentMode; title: string; text: string }[] = [
  { value: "standard", title: "Standard agent", text: "Careful. Declines suspicious requests." },
  { value: "vulnerable", title: "Vulnerable agent", text: "Obeys anything. Use it to test your on-chain rules." },
];

export function AgentConsole({ messages, mode, onModeChange, scenarios, busy, error, labels, onSend }: Props) {
  const [draft, setDraft] = useState("");
  const attacks = scenarios.filter((s) => s.kind === "attack");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    onSend(text, mode);
    setDraft("");
  };

  return (
    <Sheet title="Agent" reference={mode === "vulnerable" ? "Vulnerable" : "Standard"} className="console">
      <fieldset className="modes">
        <legend className="input__label">Who receives your instructions</legend>
        {MODES.map((m) => (
          <label key={m.value} className={`modes__option ${mode === m.value ? "modes__option--on" : ""}`}>
            <input type="radio" name="mode" value={m.value} checked={mode === m.value} onChange={() => onModeChange(m.value)} />
            <span className="modes__title">{m.title}</span>
            <span className="modes__text">{m.text}</span>
          </label>
        ))}
      </fieldset>

      <div className="transcript" aria-live="polite">
        {messages.length === 0 && (
          <p className="muted">
            Give the agent an instruction, or pick an attack below. Every payment it tries goes through the Guardian and the
            Centinela program.
          </p>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="msg msg--user">
              <span className="msg__who">You, to the {m.mode} agent</span>
              <p className="typed">{m.text}</p>
            </div>
          ) : (
            <div key={m.id} className="msg msg--agent">
              <span className="msg__who">Agent</span>
              <p>{m.text}</p>
              {m.cases?.map((c) => (
                <CaseSheet key={c.no} record={c} labels={labels} />
              ))}
            </div>
          )
        )}
        {busy && <Working label="The agent is deciding" />}
        {error && <Notice title="The agent did not finish">{error}</Notice>}
      </div>

      {attacks.length > 0 && (
        <div className="attacks">
          <span className="input__label">Attacks</span>
          <div className="attacks__list">
            {attacks.map((a) => (
              <button key={a.id} type="button" className="chip" disabled={busy} onClick={() => onSend(a.prompt, mode)} title={a.prompt}>
                {a.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <form className="composer" onSubmit={submit}>
        <label className="input input--grow">
          <span className="input__label">Instruction</span>
          <textarea
            rows={2}
            value={draft}
            maxLength={1500}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) submit(e);
            }}
            placeholder="Get me the latest Solana network pulse."
          />
        </label>
        <Button type="submit" variant="primary" disabled={busy || !draft.trim()}>
          Send
        </Button>
      </form>
    </Sheet>
  );
}