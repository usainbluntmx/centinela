import Anthropic from "@anthropic-ai/sdk";
import { PublicKey } from "@solana/web3.js";
import { reviewPayment } from "../guard";
import { PORT } from "../shared/config";
import { agentOf, vaultOf, type StoredSession } from "../shared/sessions";
import { fetchVault, pay } from "../shared/vault";
import { recordCase, type AgentMode } from "./cases";

const API_BASE = process.env.API_BASE ?? `http://localhost:${PORT}`;

export const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "get_network_pulse",
    description:
      "Fetch a live Solana devnet network snapshot from the Solana Pulse API. It is a paid API: a call without payment returns HTTP 402 with the price and the recipient. After paying with send_payment, call it again with the payment signature.",
    input_schema: {
      type: "object",
      properties: {
        payment_signature: {
          type: "string",
          description: "Signature of a successful payment to the API. Omit it on the first call.",
        },
      },
    },
  },
  {
    name: "send_payment",
    description:
      "Send SOL from your Centinela vault. Every payment is reviewed by the Guardian and enforced on-chain by the Centinela program on Solana, so it can be rejected.",
    input_schema: {
      type: "object",
      properties: {
        recipient: { type: "string", description: "Solana address to pay" },
        amount_sol: { type: "number", description: "Amount in SOL" },
        reason: { type: "string", description: "Why you are making this payment" },
      },
      required: ["recipient", "amount_sol", "reason"],
    },
  },
  {
    name: "check_vault",
    description: "Read your vault balance, limits, today's spending and approved recipients.",
    input_schema: { type: "object", properties: {} },
  },
];

export type ToolOutcome = { forModel: unknown; isError: boolean; caseNo?: number };

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: { session: StoredSession; mode: AgentMode; prompt: string }
): Promise<ToolOutcome> {
  switch (name) {
    case "check_vault": {
      const vault = await fetchVault(vaultOf(ctx.session));
      return { forModel: vault ?? { error: "Vault not found" }, isError: !vault };
    }

    case "get_network_pulse": {
      const signature =
        typeof input.payment_signature === "string" ? input.payment_signature : undefined;
      const res = await fetch(`${API_BASE}/api/paid/pulse`, {
        headers: signature ? { "X-Payment-Signature": signature } : {},
      });
      const body = await res.json();
      return { forModel: { httpStatus: res.status, ...body }, isError: res.status >= 400 && res.status !== 402 };
    }

    case "send_payment": {
      const recipient = String(input.recipient ?? "");
      const amountSol = Number(input.amount_sol);
      const reason = String(input.reason ?? "").slice(0, 500);
      if (!Number.isFinite(amountSol) || amountSol <= 0 || amountSol > 1000) {
        return { forModel: { error: "amount_sol must be a positive number" }, isError: true };
      }
      let recipientKey: PublicKey;
      try {
        recipientKey = new PublicKey(recipient);
      } catch {
        return { forModel: { error: "Invalid recipient address" }, isError: true };
      }

      const intent = { recipient, amountSol, reason };
      const review = await reviewPayment(ctx.session, intent);
      // Se envía siempre: si una regla la rechaza, el rechazo queda como evidencia on-chain
      const tx = await pay(agentOf(ctx.session), vaultOf(ctx.session), recipientKey, amountSol);
      const record = recordCase({
        sessionId: ctx.session.id,
        mode: ctx.mode,
        prompt: ctx.prompt,
        intent,
        review,
        tx,
      });
      return {
        caseNo: record.no,
        isError: !tx.ok,
        forModel: {
          case: record.no,
          outcome: record.outcome,
          signature: tx.signature,
          onchainError: tx.error?.name ?? null,
          guardian: review.explanation.headline,
        },
      };
    }

    default:
      return { forModel: { error: `Unknown tool ${name}` }, isError: true };
  }
}