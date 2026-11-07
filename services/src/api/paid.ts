import { Router } from "express";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { apiService, connection, explorerTx } from "../shared/config";
import { verifyPayment } from "./verify";

export const PRICE_SOL = 0.001;

export const paymentRequirement = () => ({
  network: "solana-devnet",
  asset: "SOL",
  amountSol: PRICE_SOL,
  recipient: apiService.publicKey.toBase58(),
  header: "X-Payment-Signature",
  description: "Solana Pulse: live devnet network snapshot",
});

async function networkPulse() {
  const [slot, epoch, samples] = await Promise.all([
    connection.getSlot(),
    connection.getEpochInfo(),
    connection.getRecentPerformanceSamples(5),
  ]);
  const avgTps = samples.length
    ? Math.round(
        samples.reduce((sum, s) => sum + s.numTransactions / s.samplePeriodSecs, 0) / samples.length
      )
    : 0;
  return {
    cluster: "devnet",
    slot,
    epoch: epoch.epoch,
    epochProgressPct: Math.round((epoch.slotIndex / epoch.slotsInEpoch) * 1000) / 10,
    avgTps,
    sampledAt: new Date().toISOString(),
  };
}

export const paidRouter = Router();

paidRouter.get("/pulse", async (req, res) => {
  const signature = req.header("x-payment-signature");

  if (!signature) {
    res.status(402).json({
      error: { code: "PAYMENT_REQUIRED", message: "Pay the price and retry with the signature header." },
      payment: paymentRequirement(),
    });
    return;
  }

  const check = await verifyPayment(
    signature,
    apiService.publicKey,
    Math.round(PRICE_SOL * LAMPORTS_PER_SOL)
  );
  if (!check.ok) {
    res.status(check.reason === "PAYMENT_ALREADY_USED" ? 409 : 402).json({
      error: { code: check.reason, message: check.message },
      payment: paymentRequirement(),
    });
    return;
  }

  res.json({
    paid: { signature, amountSol: check.amountSol, explorer: explorerTx(signature) },
    data: await networkPulse(),
  });
});