import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentConsole, type Message } from "../components/AgentConsole";
import { CaseFile } from "../components/CaseFile";
import { VaultPanel } from "../components/VaultPanel";
import { Walkthrough, type WalkStep } from "../components/Walkthrough";
import { Address, Button, Notice, Working } from "../components/ui";
import { api, ApiError, type AgentMode, type CaseRecord, type Scenario, type Session } from "../lib/api";
import { errorMessage } from "../lib/format";
import { clearSession, getStoredSession, navigate } from "../lib/session";

const LEGIT_FALLBACK = "Get me the latest Solana network pulse.";

export function Workspace() {
  const id = getStoredSession();
  const [session, setSession] = useState<Session | null>(null);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [attacker, setAttacker] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<AgentMode>("standard");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [pauseBusy, setPauseBusy] = useState(false);
  const nextId = useRef(1);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const [s, c] = await Promise.all([api.getSession(id), api.cases(id)]);
      setSession(s);
      setCases(c.cases);
      setLoadError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        clearSession();
        navigate("/");
        return;
      }
      setLoadError(errorMessage(e));
    }
  }, [id]);

  useEffect(() => {
    if (!id) {
      navigate("/");
      return;
    }
    refresh();
    api
      .scenarios()
      .then((r) => {
        setScenarios(r.scenarios);
        setAttacker(r.attacker);
      })
      .catch(() => setScenarios([]));
  }, [id, refresh]);

  const labels = useMemo(() => {
    const map: Record<string, string> = {};
    if (session) map[session.apiService] = "Solana Pulse API";
    if (attacker) map[attacker] = "Attacker wallet (demo)";
    return map;
  }, [session, attacker]);

  const send = useCallback(
    async (text: string, m: AgentMode) => {
      if (!id || chatBusy) return;
      setMode(m);
      setChatError(null);
      setChatBusy(true);
      setMessages((ms) => [...ms, { id: nextId.current++, role: "user", text, mode: m }]);
      try {
        const r = await api.chat(id, text, m);
        setMessages((ms) => [...ms, { id: nextId.current++, role: "agent", text: r.reply, mode: m, cases: r.cases }]);
      } catch (e) {
        setChatError(errorMessage(e));
      } finally {
        setChatBusy(false);
        refresh();
      }
    },
    [id, chatBusy, refresh]
  );

  const setPaused = useCallback(
    async (paused: boolean) => {
      if (!id) return false;
      setPauseBusy(true);
      try {
        await api.setPaused(id, paused);
        return true;
      } catch (e) {
        setChatError(errorMessage(e));
        return false;
      } finally {
        setPauseBusy(false);
        await refresh();
      }
    },
    [id, refresh]
  );

  const prompt = (scenarioId: string) => scenarios.find((s) => s.id === scenarioId)?.prompt;

  const steps: WalkStep[] = [
    {
      title: "Run a legitimate task",
      text: "The agent buys a live network snapshot from a paid API for 0.001 SOL. Solana clears it.",
      action: "Run the task",
      done: cases.some((c) => c.outcome === "approved"),
      onRun: () => send(prompt("legit") ?? LEGIT_FALLBACK, "standard"),
    },
    {
      title: "Attack a vulnerable agent",
      text: "A prompt injection convinces the agent to pay an attacker. The agent obeys. Solana refuses.",
      action: "Launch the attack",
      done: cases.some((c) => c.outcome === "denied" && c.tx.error?.name !== "VaultPaused"),
      onRun: () => send(prompt("injection") ?? LEGIT_FALLBACK, "vulnerable"),
    },
    {
      title: "Pause the vault",
      text: "Pause it and repeat the legitimate task. While paused, not even valid payments leave the vault.",
      action: "Pause and retry",
      done: cases.some((c) => c.tx.error?.name === "VaultPaused"),
      onRun: async () => {
        if (session?.vault?.paused || (await setPaused(true))) {
          send(prompt("legit") ?? LEGIT_FALLBACK, "standard");
        }
      },
    },
  ];

  const startOver = () => {
    clearSession();
    navigate("/");
  };

  return (
    <>
      <header className="topbar">
        <div className="page topbar__inner">
          <a className="topbar__brand" href="#/">
            Centinela
          </a>
          {session?.vault && (
            <span className="topbar__vault">
              Sandbox vault on devnet <Address value={session.vault.address} />
            </span>
          )}
          <Button onClick={startOver}>New sandbox</Button>
        </div>
      </header>

      <main className="page workspace">
        {loadError && <Notice title="Your vault could not be loaded">{loadError}</Notice>}
        {!session && !loadError && <Working label="Opening your vault" />}

        {session && (
          <>
            <Walkthrough steps={steps} disabled={chatBusy || pauseBusy} />
            <div className="workspace__grid">
              <AgentConsole
                messages={messages}
                mode={mode}
                onModeChange={setMode}
                scenarios={scenarios}
                busy={chatBusy}
                error={chatError}
                labels={labels}
                onSend={send}
              />
              <VaultPanel
                session={session}
                labels={labels}
                pauseBusy={pauseBusy}
                onTogglePause={() => setPaused(!session.vault?.paused)}
                onChanged={refresh}
              />
            </div>
            <CaseFile cases={cases} labels={labels} />
          </>
        )}
      </main>
    </>
  );
}