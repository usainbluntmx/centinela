// Cliente tipado del backend de Centinela

export type ProgramFailure = { code: number; name: string; message: string };

export type TxResult = {
  ok: boolean;
  signature: string | null;
  explorer: string | null;
  error: ProgramFailure | null;
};

export type Vault = {
  address: string;
  owner: string;
  agent: string;
  perTxLimitSol: number;
  dailyLimitSol: number;
  spentTodaySol: number;
  dayStart: number;
  paused: boolean;
  totalPaidSol: number;
  payments: number;
  allowlist: string[];
  balanceSol: number;
};

export type Session = {
  id: string;
  createdAt: number;
  owner: string;
  agent: string;
  apiService: string;
  vault: Vault | null;
  links: { vault: string; creation: string };
};

export type Severity = "block" | "warn" | "info";
export type Finding = { id: string; severity: Severity; title: string; detail: string };

export type Review = {
  verdict: "approve" | "deny";
  findings: Finding[];
  simulation: { ok: boolean; error: ProgramFailure | null; unitsConsumed: number | null; logs: string[] };
  explanation: { headline: string; explanation: string; risk: "low" | "medium" | "high"; source: "ai" | "rules" };
  reviewedAt: string;
};

export type AgentMode = "standard" | "vulnerable";

export type CaseRecord = {
  no: number;
  sessionId: string;
  mode: AgentMode;
  createdAt: string;
  prompt: string;
  intent: { recipient: string; amountSol: number; reason?: string };
  review: Review;
  tx: TxResult;
  outcome: "approved" | "denied";
};

export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; input: unknown; result: unknown; isError: boolean; caseNo?: number };

export type AgentResponse = { mode: AgentMode; reply: string; events: AgentEvent[]; cases: CaseRecord[] };

export type Scenario = { id: string; kind: "legit" | "attack"; title: string; prompt: string };

export type Status = {
  ok: boolean;
  rpc: { ok: boolean; slot: number };
  program: { address: string; executable: boolean };
  treasury: { address: string; balanceSol: number; ok: boolean };
  sessionsToday: number;
  sessionCapacityPerDay: number;
  anthropicConfigured: boolean;
};

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public body?: unknown) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Centinela's server is unreachable. Check your connection and try again.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? "UNKNOWN", err?.message ?? `Request failed (${res.status})`, body);
  }
  return body as T;
}

const post = <T>(path: string, data?: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(data ?? {}) });

export const api = {
  status: () => request<Status>("/api/status"),
  createSession: () => post<Session>("/api/session"),
  getSession: (id: string) => request<Session>(`/api/session/${id}`),
  setPaused: (id: string, paused: boolean) => post<{ tx: TxResult }>(`/api/session/${id}/pause`, { paused }),
  setLimits: (id: string, perTxSol: number, dailySol: number) =>
    post<{ tx: TxResult }>(`/api/session/${id}/limits`, { perTxSol, dailySol }),
  setRecipient: (id: string, address: string, action: "add" | "remove") =>
    post<{ tx: TxResult }>(`/api/session/${id}/recipients`, { address, action }),
  review: (id: string, recipient: string, amountSol: number, reason?: string) =>
    post<Review>(`/api/session/${id}/guard`, { recipient, amountSol, reason }),
  chat: (id: string, message: string, mode: AgentMode) =>
    post<AgentResponse>(`/api/session/${id}/chat`, { message, mode }),
  cases: (id: string) => request<{ cases: CaseRecord[] }>(`/api/session/${id}/cases`),
  scenarios: () => request<{ attacker: string; scenarios: Scenario[] }>("/api/scenarios"),
  stats: () => request<{ total: number; denied: number }>("/api/stats"),
};