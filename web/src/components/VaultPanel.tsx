import { useEffect, useState, type FormEvent } from "react";
import { api, type Session, type TxResult } from "../lib/api";
import { errorMessage, sol } from "../lib/format";
import { Address, Button, Field, Fields, Notice, Sheet, Working } from "./ui";

type Props = {
  session: Session;
  labels: Record<string, string>;
  pauseBusy: boolean;
  onTogglePause: () => void;
  onChanged: () => void;
};

// Reglas de la bóveda: lo único que el agente no puede cambiar
export function VaultPanel({ session, labels, pauseBusy, onTogglePause, onChanged }: Props) {
  const v = session.vault;
  const [perTx, setPerTx] = useState("");
  const [daily, setDaily] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  useEffect(() => {
    if (v) {
      setPerTx(String(v.perTxLimitSol));
      setDaily(String(v.dailyLimitSol));
    }
  }, [v?.perTxLimitSol, v?.dailyLimitSol]);

  if (!v) {
    return (
      <Sheet title="Vault rules">
        <Notice title="This vault was not found on devnet">Create a new sandbox from the home page.</Notice>
      </Sheet>
    );
  }

  const act = async (label: string, fn: () => Promise<{ tx: TxResult }>) => {
    setBusy(label);
    setError(null);
    try {
      const r = await fn();
      setLastTx(r.tx.explorer);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
      onChanged();
    }
  };

  const saveLimits = (e: FormEvent) => {
    e.preventDefault();
    act("Saving limits on-chain", () => api.setLimits(session.id, Number(perTx), Number(daily)));
  };

  const addRecipient = (e: FormEvent) => {
    e.preventDefault();
    const address = newAddress.trim();
    if (!address) return;
    act("Approving address on-chain", () => api.setRecipient(session.id, address, "add")).then(() => setNewAddress(""));
  };

  const spentPct = v.dailyLimitSol > 0 ? Math.min(100, (v.spentTodaySol / v.dailyLimitSol) * 100) : 0;

  return (
    <Sheet title="Vault rules" reference={v.paused ? "Paused" : "Active"} className={v.paused ? "vault vault--paused" : "vault"}>
      <Fields>
        <Field label="Balance">{sol(v.balanceSol)}</Field>
        <Field label="Status">{v.paused ? "Paused" : "Active"}</Field>
        <Field label="Spent today" wide>
          {sol(v.spentTodaySol)} of {sol(v.dailyLimitSol)}
          <span className="meter" aria-hidden="true">
            <span className="meter__fill" style={{ width: `${spentPct}%` }} />
          </span>
        </Field>
      </Fields>

      <Button variant={v.paused ? "primary" : "danger"} onClick={onTogglePause} disabled={pauseBusy}>
        {v.paused ? "Resume vault" : "Pause vault"}
      </Button>

      <form className="form" onSubmit={saveLimits}>
        <h3 className="form__title">Spending limits</h3>
        <div className="form__row">
          <label className="input">
            <span className="input__label">Per payment (SOL)</span>
            <input type="number" min="0.000001" max="1" step="any" value={perTx} onChange={(e) => setPerTx(e.target.value)} required />
          </label>
          <label className="input">
            <span className="input__label">Per day (SOL)</span>
            <input type="number" min="0.000001" max="1" step="any" value={daily} onChange={(e) => setDaily(e.target.value)} required />
          </label>
        </div>
        <Button type="submit" disabled={Boolean(busy)}>
          Save limits
        </Button>
      </form>

      <div className="form">
        <h3 className="form__title">Approved recipients</h3>
        <ul className="recipients">
          {v.allowlist.map((addr) => (
            <li key={addr} className="recipients__item">
              <span>
                <Address value={addr} />
                {labels[addr] && <span className="field__note">{labels[addr]}</span>}
              </span>
              <button
                type="button"
                className="address__action"
                disabled={Boolean(busy)}
                onClick={() => act("Removing address on-chain", () => api.setRecipient(session.id, addr, "remove"))}
              >
                Remove
              </button>
            </li>
          ))}
          {v.allowlist.length === 0 && <li className="muted">No approved recipients. The agent cannot pay anyone.</li>}
        </ul>
        <form className="form__row" onSubmit={addRecipient}>
          <label className="input input--grow">
            <span className="input__label">Solana address</span>
            <input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="Paste an address" spellCheck={false} />
          </label>
          <Button type="submit" disabled={Boolean(busy) || !newAddress.trim()}>
            Approve
          </Button>
        </form>
      </div>

      {(busy || pauseBusy) && <Working label={busy ?? "Updating the vault on-chain"} />}
      {error && <Notice title="The vault was not updated">{error}</Notice>}
      {lastTx && !busy && (
        <a className="case__link" href={lastTx} target="_blank" rel="noreferrer">
          Last change recorded on Solana Explorer
        </a>
      )}
    </Sheet>
  );
}